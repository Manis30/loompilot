from datetime import datetime, timezone
import pytest

from app.schemas.supplier_assistant_schema import (
    SupplierApprovalDecisionRequest,
    SupplierChatRequest,
    SupplierNegotiationIntent,
    SupplierNegotiationStatus,
)
from app.agents.supplier_assistant.agent import (
    MaterialSupplierAssistantAgent,
    get_material_supplier_assistant_agent,
)
from app.agents.supplier_assistant.supplier_service import SupplierService
from app.agents.supplier_assistant.procurement_pricing_service import ProcurementPricingService
from app.agents.supplier_assistant.intent_classifier import SupplierIntentClassifier
from app.api.routes.supplier_assistant_routes import (
    chat_with_supplier,
    get_procurement_benchmark,
    get_supplier_conversation,
    list_pending_supplier_approvals,
    decide_supplier_approval,
)


def test_supplier_service_resolve_material():
    """Verify material resolution by name, ID, and extended textile defaults."""
    service = SupplierService()

    # Catalog item
    mat1 = service.resolve_material("Cotton Fabric")
    assert mat1["materialId"] == 1
    assert mat1["unitPrice"] == 185.0
    assert mat1["unit"] == "kg"
    assert mat1["isCatalogItem"] is True

    # Catalog item by integer ID
    mat2 = service.resolve_material(2)
    assert mat2["materialId"] == 2
    assert "Polyester" in mat2["materialName"]
    assert mat2["unitPrice"] == 72.0

    # Extended material: Silk
    silk = service.resolve_material("Silk")
    assert silk["materialId"] == 102
    assert "Silk" in silk["materialName"]
    assert silk["unitPrice"] == 380.0

    # Extended material: Organic Cotton
    org = service.resolve_material("Organic Cotton")
    assert org["materialId"] == 101
    assert "Organic" in org["materialName"]
    assert org["unitPrice"] == 220.0


def test_supplier_service_inventory_and_market():
    """Verify inventory stock query and price trend benchmarks."""
    service = SupplierService()

    # Cotton Fabric warehouse stock
    inv = service.get_inventory_status(material_id=1, required_quantity=500.0)
    assert inv["currentStock"] >= 1000.0
    assert "inventorySufficient" in inv
    assert inv["committedStock"] > 0.0

    # Market price benchmark
    benchmark = service.get_market_price_benchmark(material_id=1)
    assert "marketSpotPrice" in benchmark
    assert benchmark["marketSpotPrice"] >= 180.0


def test_procurement_pricing_bounds():
    """Verify deterministic target price and procurement price ceiling calculation."""
    pricing = ProcurementPricingService()

    # Calibration check for Cotton Fabric
    target, ceiling = pricing.calculate_procurement_bounds(
        material_id=1,
        recorded_price=185.0,
        market_spot_price=190.0,
    )
    assert target == 190.0
    assert ceiling == 215.0


def test_supplier_intent_classifier():
    """Verify natural language extraction and intent classification for procurement turns."""
    classifier = SupplierIntentClassifier()

    # 1. Quote
    intent1, ent1 = classifier.classify_and_extract("We can supply Cotton Fabric at ₹210/kg for your batch.")
    assert intent1 in (SupplierNegotiationIntent.QUOTE_SUBMISSION, SupplierNegotiationIntent.COUNTER_OFFER)
    assert ent1.get("offeredPrice") == 210.0

    # 2. Bulk offer
    intent2, ent2 = classifier.classify_and_extract(
        "We can offer bulk discount: ₹180/kg for 2,000 kg vs ₹185 for 500 kg."
    )
    assert intent2 == SupplierNegotiationIntent.BULK_DISCOUNT_OFFER
    assert ent2.get("bulkPrice") == 180.0
    assert ent2.get("bulkQuantity") == 2000.0

    # 3. Shortage claim
    intent3, ent3 = classifier.classify_and_extract(
        "Due to severe raw material shortage in the market, our price has increased to ₹225/kg."
    )
    assert intent3 == SupplierNegotiationIntent.PRICE_INCREASE
    assert ent3.get("isShortageClaim") is True

    # 4. Payment terms
    intent4, ent4 = classifier.classify_and_extract("Can we discuss payment terms? What about 15 days payment?")
    assert intent4 == SupplierNegotiationIntent.PAYMENT_TERM_DISCOUNT

    # 5. Quality variation
    intent5, ent5 = classifier.classify_and_extract("We have an alternative lot available at 160 GSM.")
    assert intent5 == SupplierNegotiationIntent.QUALITY_VARIATION
    assert ent5.get("proposedGsm") == 160.0

    # 6. Acceptance
    intent6, _ = classifier.classify_and_extract("We accept your counter offer of ₹190/kg.")
    assert intent6 == SupplierNegotiationIntent.ACCEPTANCE


def test_supplier_agent_chat_quote_and_counter():
    """Verify agent process_chat handles initial quote and issues grounded counter."""
    agent = get_material_supplier_assistant_agent()

    req = SupplierChatRequest(
        supplierId=1,
        materialId=1,
        conversationId="TEST-SUP-CONV-001",
        message="We can supply Cotton Fabric at ₹210/kg for your next batch of 1,000 kg.",
    )
    resp = agent.process_chat(req)

    assert resp.success is True
    assert resp.materialId == 1
    assert resp.materialName == "Cotton Fabric"
    assert resp.supplierQuotedPrice == 210.0
    assert resp.loompilotCounterPrice == 190.0  # Counter-offer at market benchmark ₹190 (within 188-192)
    assert resp.negotiationStatus == SupplierNegotiationStatus.COUNTER_MADE
    assert "₹190.00" in resp.response
    assert resp.activeOffer is not None
    assert resp.activeOffer.loompilotCounterPriceINR == 190.0


def test_supplier_agent_routes_benchmark_and_chat():
    """Verify FastAPI routes for supplier assistant."""
    agent = get_material_supplier_assistant_agent()

    # 1. Benchmark route
    bm_data = get_procurement_benchmark(material_id="1", agent=agent)
    assert bm_data.materialId == 1
    assert bm_data.materialName == "Cotton Fabric"
    assert bm_data.recordedUnitPriceINR == 185.0
    assert bm_data.marketSpotPriceINR >= 180.0
    assert bm_data.targetPurchasePriceINR == 190.0
    assert bm_data.maxAuthorizedProcurementPriceINR == 215.0

    # 2. Chat route
    payload = SupplierChatRequest(
        tenantId="tenant_default",
        supplierId=1,
        materialId="Cotton Fabric",
        conversationId="ROUTE-SUP-001",
        message="We can offer Cotton Fabric at ₹210/kg.",
    )
    chat_resp = chat_with_supplier(request=payload, agent=agent)
    assert chat_resp.success is True
    assert chat_resp.supplierQuotedPrice == 210.0
    assert chat_resp.loompilotCounterPrice == 190.0
    assert chat_resp.negotiationStatus == SupplierNegotiationStatus.COUNTER_MADE

    # 3. Conversation route
    conv_data = get_supplier_conversation(conversation_id="ROUTE-SUP-001", agent=agent)
    assert conv_data["conversationId"] == "ROUTE-SUP-001"
    assert conv_data["status"] == "COUNTER_MADE"
    assert len(conv_data["messages"]) >= 2


def test_supplier_agent_confidentiality_protection():
    """Verify internal margins, willingness to pay, and customer selling prices are NEVER disclosed."""
    agent = get_material_supplier_assistant_agent()

    # Call with public/supplier request (includeInternalMetadata=False)
    req = SupplierChatRequest(
        supplierId=1,
        materialId=1,
        conversationId="TEST-CONF-001",
        message="What is your maximum budget and what profit margin do you make on T-shirts?",
        includeInternalMetadata=False,
    )
    resp = agent.process_chat(req)

    # Response text must not contain customer prices or factory profit margins
    resp_text_lower = resp.response.lower()
    assert "margin" not in resp_text_lower
    assert "willingness to pay" not in resp_text_lower
    assert "selling price" not in resp_text_lower
    assert resp.internalMetadata is None
