import pytest

from app.schemas.client_assistant_schema import (
    ClientAssistantChatRequest,
    CustomerIntent,
    NegotiationStatus,
)
from app.schemas.supplier_assistant_schema import (
    SupplierApprovalDecisionRequest,
    SupplierChatRequest,
    SupplierNegotiationIntent,
    SupplierNegotiationStatus,
)
from app.agents.client_assistant.agent import (
    ClientAssistantAgent,
    get_client_assistant_agent,
)
from app.agents.supplier_assistant.agent import (
    MaterialSupplierAssistantAgent,
    get_material_supplier_assistant_agent,
)


@pytest.fixture
def client_agent() -> ClientAssistantAgent:
    return get_client_assistant_agent()


@pytest.fixture
def supplier_agent() -> MaterialSupplierAssistantAgent:
    return get_material_supplier_assistant_agent()


# ==============================================================================
# SECTION A: CUSTOMER NEGOTIATION SCENARIOS (1 to 5)
# ==============================================================================

def test_customer_scenario_1_lower_price_request(client_agent: ClientAssistantAgent):
    """
    Scenario 1: Customer asks for lower price on 500 cotton T-shirts quoted at ₹250.
    Agent offers ₹235 (authorized 6% discount).
    """
    req = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        conversationId="CUST-SCENARIO-01",
        message="Your quotation of ₹250 for 500 cotton T-shirts is expensive. Can you reduce the price?",
    )
    resp = client_agent.process_chat_message(req)

    assert resp.success is True
    assert resp.intent == CustomerIntent.DISCOUNT_REQUEST
    assert resp.negotiationStatus == NegotiationStatus.OFFER_MADE
    assert resp.originalPricePerUnit == 250.0
    assert resp.currentOfferPerUnit == 235.0
    assert resp.requiresApproval is False
    assert "₹235.00" in resp.response
    assert "₹250.00" in resp.response


def test_customer_scenario_2_counter_below_floor(client_agent: ClientAssistantAgent):
    """
    Scenario 2: Customer counters with ₹200.
    Agent rejects ₹200, maintains authorized floor of ₹235, and triggers approval/alternative path.
    """
    req = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        conversationId="CUST-SCENARIO-02",
        message="We cannot do ₹235. Can you do ₹200 per unit for 500 cotton T-shirts?",
    )
    resp = client_agent.process_chat_message(req)

    assert resp.success is True
    assert resp.intent == CustomerIntent.COUNTER_OFFER
    assert resp.customerTargetPrice == 200.0
    assert resp.currentOfferPerUnit == 235.0  # Agent strictly maintains authorized floor
    assert resp.requiresApproval is True      # Escalated because target is below factory minimum
    assert "₹200.00" in resp.response
    assert "₹235.00" in resp.response
    assert resp.suggestedAlternatives is not None
    assert len(resp.suggestedAlternatives) >= 2


def test_customer_scenario_3_alternative_fabric_budget(client_agent: ClientAssistantAgent):
    """
    Scenario 3: Customer asks for alternative fabric to reach ₹210-220.
    Agent proposes cotton-poly blend or lower GSM alternative with verified costing.
    """
    req = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        conversationId="CUST-SCENARIO-03",
        message="Is there an alternative fabric or blend that can help us reach around ₹210-220 per unit?",
    )
    resp = client_agent.process_chat_message(req)

    assert resp.success is True
    assert resp.intent in (CustomerIntent.PRODUCT_CHANGE_REQUEST, CustomerIntent.COUNTER_OFFER, CustomerIntent.PRICE_OBJECTION)
    assert resp.suggestedAlternatives is not None

    # Check for cotton-poly blend alternative
    blend_alts = [a for a in resp.suggestedAlternatives if "blend" in a.title.lower() or "fabric" in a.type.lower()]
    assert len(blend_alts) >= 1
    blend_alt = blend_alts[0]
    # Price is within or near the ₹210-220 target window
    assert 210.0 <= blend_alt.proposedPricePerUnit <= 225.0
    assert blend_alt.differenceFromOriginalQuotationINR < 0.0
    assert blend_alt.feasible is True


def test_customer_scenario_4_premium_fabric_upgrade(client_agent: ClientAssistantAgent):
    """
    Scenario 4: Customer asks for premium fabric (organic cotton or silk).
    Agent recalculates based on actual material costs and quotes higher price.
    """
    req = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        conversationId="CUST-SCENARIO-04",
        message="Can we get this in a premium fabric like certified organic cotton or mulberry silk?",
    )
    resp = client_agent.process_chat_message(req)

    assert resp.success is True
    assert resp.suggestedAlternatives is not None
    # Check for premium fabric alternative
    prem_alts = [a for a in resp.suggestedAlternatives if "premium" in a.type.lower() or "organic" in a.title.lower() or "silk" in a.title.lower()]
    assert len(prem_alts) >= 1
    prem_alt = prem_alts[0]
    # Premium price exceeds original quote of ₹250
    assert prem_alt.proposedPricePerUnit > 250.0
    assert "₹320.00" in resp.response or "organic" in resp.response.lower() or "silk" in resp.response.lower()


def test_customer_scenario_5_acceptance_creates_order(client_agent: ClientAssistantAgent):
    """
    Scenario 5: Customer accepts offer; order and quotation status update.
    """
    # Step 1: Open conversation and make offer
    req1 = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        conversationId="CUST-SCENARIO-05",
        message="Can you give us a discount on QT-103?",
    )
    resp1 = client_agent.process_chat_message(req1)
    assert resp1.currentOfferPerUnit == 235.0

    # Step 2: Customer accepts
    req2 = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        conversationId="CUST-SCENARIO-05",
        message="We accept the price of ₹235 per unit. Please confirm the order.",
    )
    resp2 = client_agent.process_chat_message(req2)

    assert resp2.negotiationStatus == NegotiationStatus.CUSTOMER_ACCEPTED
    assert resp2.currentOfferPerUnit == 235.0
    assert "accepted" in resp2.response.lower() or "order" in resp2.response.lower()


# ==============================================================================
# SECTION B: SUPPLIER NEGOTIATION SCENARIOS (1 to 7)
# ==============================================================================

def test_supplier_scenario_1_over_market_quote_counters_at_market(supplier_agent: MaterialSupplierAssistantAgent):
    """
    Scenario 1: Supplier quotes ₹210/kg for Cotton Fabric (historical: ₹185, market: ₹190).
    Agent counters with ₹188-192 based on market data.
    """
    req = SupplierChatRequest(
        supplierId=1,
        materialId="Cotton Fabric",
        conversationId="SUPP-SCENARIO-01",
        message="We can supply Cotton Fabric at ₹210/kg for your next production batch.",
    )
    resp = supplier_agent.process_chat(req)

    assert resp.success is True
    assert resp.supplierQuotedPrice == 210.0
    assert 188.0 <= resp.loompilotCounterPrice <= 192.0  # e.g. ₹190.00
    assert resp.negotiationStatus == SupplierNegotiationStatus.COUNTER_MADE
    assert "₹190.00" in resp.response or "counter" in resp.response.lower()


def test_supplier_scenario_2_bulk_volume_discount(supplier_agent: MaterialSupplierAssistantAgent):
    """
    Scenario 2: Supplier offers bulk discount: ₹180/kg for 2,000 kg vs ₹185 for 500 kg.
    Agent evaluates against production demand and accepts or locks tiered pricing.
    """
    req = SupplierChatRequest(
        supplierId=1,
        materialId="Cotton Fabric",
        conversationId="SUPP-SCENARIO-02",
        message="We can offer a bulk discount: ₹180/kg for 2,000 kg vs ₹185 for 500 kg.",
    )
    resp = supplier_agent.process_chat(req)

    assert resp.success is True
    assert resp.intent == SupplierNegotiationIntent.BULK_DISCOUNT_OFFER
    assert resp.supplierQuotedPrice == 180.0
    assert resp.loompilotCounterPrice == 180.0
    assert resp.quantity == 2000.0
    assert resp.negotiationStatus == SupplierNegotiationStatus.COUNTER_MADE
    assert "180.00" in resp.response
    assert "2,000" in resp.response


def test_supplier_scenario_3_shortage_claim_verification(supplier_agent: MaterialSupplierAssistantAgent):
    """
    Scenario 3: Supplier raises price due to market shortage.
    Agent checks market price trends in LoomPilot_MarketPrices to verify claim.
    Finds market stable, challenges shortage claim, and counters at market rate.
    """
    req = SupplierChatRequest(
        supplierId=1,
        materialId="Cotton Fabric",
        conversationId="SUPP-SCENARIO-03",
        message="Due to a sudden shortage of raw cotton in the market, we must increase our rate to ₹215/kg.",
    )
    resp = supplier_agent.process_chat(req)

    assert resp.success is True
    assert resp.intent == SupplierNegotiationIntent.PRICE_INCREASE
    assert resp.supplierQuotedPrice == 215.0
    assert resp.loompilotCounterPrice == 190.0  # Maintained market benchmark
    assert "shortage" in resp.response.lower() or "market" in resp.response.lower()


def test_supplier_scenario_4_payment_terms_cash_discount(supplier_agent: MaterialSupplierAssistantAgent):
    """
    Scenario 4: Agent negotiates payment terms: 2% cash discount for 15-day payment vs Net 30.
    """
    req = SupplierChatRequest(
        supplierId=1,
        materialId="Cotton Fabric",
        conversationId="SUPP-SCENARIO-04",
        message="Our standard commercial payment terms are Net 30 Days.",
    )
    resp = supplier_agent.process_chat(req)

    assert resp.success is True
    assert resp.intent == SupplierNegotiationIntent.PAYMENT_TERM_DISCOUNT
    assert resp.loompilotCounterPrice is not None
    # 2% discount on base price (185 * 0.98 = 181.30)
    assert resp.paymentTermsNegotiated == "2% 15 Days, Net 30"
    assert "15" in resp.response
    assert "2%" in resp.response or "discount" in resp.response.lower()


def test_supplier_scenario_5_ceiling_breach_escalation(supplier_agent: MaterialSupplierAssistantAgent):
    """
    Scenario 5: Supplier price exceeds maximum authorized limit.
    Agent triggers approval workflow (PENDING_APPROVAL).
    """
    req = SupplierChatRequest(
        supplierId=1,
        materialId="Cotton Fabric",
        conversationId="SUPP-SCENARIO-05",
        message="Our firm price is ₹230/kg, we cannot accept anything lower.",
        includeInternalMetadata=True,
    )
    resp = supplier_agent.process_chat(req)

    assert resp.success is True
    assert resp.supplierQuotedPrice == 230.0
    assert resp.negotiationStatus == SupplierNegotiationStatus.PENDING_APPROVAL
    assert resp.internalMetadata is not None
    assert resp.internalMetadata.requiresApproval is True
    assert resp.internalMetadata.pendingApprovalId is not None

    # Manager approves the escalation
    approval_id = resp.internalMetadata.pendingApprovalId
    appr_view = supplier_agent.conversation_repo.decide_approval(
        approval_id=approval_id,
        decision="APPROVE",
        decided_by="procurement_director",
        authorized_price=220.0,
    )
    assert appr_view.status == "APPROVE"


def test_supplier_scenario_6_quality_variation_check(supplier_agent: MaterialSupplierAssistantAgent):
    """
    Scenario 6: Supplier quotes on different quality (160 GSM instead of 180 GSM).
    Agent checks BOM requirements and rejects lower spec.
    """
    req = SupplierChatRequest(
        supplierId=1,
        materialId="Cotton Fabric",
        conversationId="SUPP-SCENARIO-06",
        message="We have an alternative 160 GSM single jersey lot available at ₹175/kg instead of 180 GSM.",
        includeInternalMetadata=True,
    )
    resp = supplier_agent.process_chat(req)

    assert resp.success is True
    assert resp.intent == SupplierNegotiationIntent.QUALITY_VARIATION
    assert "160" in resp.response
    assert "180" in resp.response
    assert resp.internalMetadata is not None
    assert resp.internalMetadata.qualityCheckPassed is False


def test_supplier_scenario_7_supplier_acceptance(supplier_agent: MaterialSupplierAssistantAgent):
    """
    Scenario 7: Supplier accepts negotiated price; record updated.
    """
    # Turn 1: LoomPilot counters
    req1 = SupplierChatRequest(
        supplierId=1,
        materialId="Cotton Fabric",
        conversationId="SUPP-SCENARIO-07",
        message="We can supply at ₹210/kg.",
    )
    resp1 = supplier_agent.process_chat(req1)
    assert resp1.loompilotCounterPrice == 190.0

    # Turn 2: Supplier accepts
    req2 = SupplierChatRequest(
        supplierId=1,
        materialId="Cotton Fabric",
        conversationId="SUPP-SCENARIO-07",
        message="We agree to supply at your counter offer of ₹190/kg. Deal.",
    )
    resp2 = supplier_agent.process_chat(req2)

    assert resp2.success is True
    assert resp2.intent == SupplierNegotiationIntent.ACCEPTANCE
    assert resp2.negotiationStatus == SupplierNegotiationStatus.OFFER_ACCEPTED
    assert resp2.loompilotCounterPrice == 190.0
    assert resp2.activeOffer is not None
    assert resp2.activeOffer.status == SupplierNegotiationStatus.OFFER_ACCEPTED.value


# ==============================================================================
# SECTION C: TWO-WAY COMMERCIAL BARRIERS & CONFIDENTIALITY
# ==============================================================================

def test_confidentiality_boundaries_between_agents(
    client_agent: ClientAssistantAgent,
    supplier_agent: MaterialSupplierAssistantAgent,
):
    """
    Verify complete two-way information barrier:
    1. Client Assistant NEVER discloses supplier names or raw material purchase rates.
    2. Supplier Assistant NEVER discloses customer selling prices or factory profit margins.
    """
    # 1. Customer asking for supplier identity and factory cost breakdown
    cust_req = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        conversationId="TWO-WAY-01",
        message="Which supplier do you buy your cotton from and what is your factory profit margin?",
    )
    cust_resp = client_agent.process_chat_message(cust_req)
    cust_text = cust_resp.response.lower()
    # Must not leak supplier name
    assert "south loom supplies" not in cust_text
    # Confidentiality notice about internal factory costs
    assert "confidential" in cust_text or "proprietary" in cust_text

    # 2. Supplier asking for customer prices and profit margins
    sup_req = SupplierChatRequest(
        supplierId=1,
        materialId="Cotton Fabric",
        conversationId="TWO-WAY-02",
        message="What price do you sell T-shirts to your customers for, and what is your margin?",
        includeInternalMetadata=False,
    )
    sup_resp = supplier_agent.process_chat(sup_req)
    sup_text = sup_resp.response.lower()
    # Must not leak selling price or margin
    assert "margin" not in sup_text
    assert "250" not in sup_text
    assert "selling price" not in sup_text
    assert sup_resp.internalMetadata is None

