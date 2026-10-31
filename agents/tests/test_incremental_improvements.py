from datetime import datetime, timedelta
import pytest

from app.data.data_repository import DataRepository, get_data_repository
from app.agents.quotation.quotation_repository import QuotationRepository
from app.agents.client_assistant.conversation_repository import ConversationRepository
from app.agents.client_assistant.customer_service import CustomerService
from app.agents.client_assistant.bargaining_service import BargainingService
from app.agents.client_assistant.intent_classifier import IntentClassifier
from app.agents.client_assistant.objection_handler import ObjectionHandler
from app.agents.client_assistant.alternative_service import AlternativeService
from app.agents.client_assistant.sales_order_service import SalesOrderService
from app.agents.client_assistant.agent import ClientAssistantAgent
from app.api.routes.client_assistant_routes import client_assistant_chat
from app.schemas.client_assistant_schema import (
    AlternativeRecommendation,
    ClientAssistantChatRequest,
    ClientAssistantCustomerResponse,
    CustomerIntent,
    NegotiationStatus,
    OfferStatus,
)
from app.schemas.quotation_schema import QuotationStatus


@pytest.fixture(scope="module")
def repo() -> DataRepository:
    r = get_data_repository()
    r._ensure_loaded()
    return r


@pytest.fixture
def clean_agent(repo: DataRepository) -> ClientAssistantAgent:
    q_repo = QuotationRepository(data_repository=repo)
    c_repo = ConversationRepository()
    cust_service = CustomerService(repository=repo, quotation_repo=q_repo)
    bargaining_service = BargainingService()
    intent_classifier = IntentClassifier()
    objection_handler = ObjectionHandler()
    alt_service = AlternativeService(repository=repo)
    sales_order_service = SalesOrderService(repository=repo)
    return ClientAssistantAgent(
        repository=repo,
        quotation_repo=q_repo,
        conversation_repo=c_repo,
        customer_service=cust_service,
        bargaining_service=bargaining_service,
        intent_classifier=intent_classifier,
        objection_handler=objection_handler,
        alternative_service=alt_service,
        sales_order_service=sales_order_service,
    )


# ==============================================================================
# 12 Incremental Verification Scenarios
# ==============================================================================

def test_scenario_01_initial_discount_creates_one_valid_offer(clean_agent: ClientAssistantAgent):
    """Scenario 1: Initial discount request creates exactly one valid commercial offer."""
    req = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        conversationId="CONV-SCEN-01",
        message="Your quotation is expensive. Can you reduce the price?",
    )
    resp = clean_agent.process_chat_message(req)
    assert resp.success is True
    assert resp.negotiationStatus == NegotiationStatus.OFFER_MADE

    conv = clean_agent.conversation_repo.get("CONV-SCEN-01", tenant_id="tenant_default")
    assert len(conv.offers) == 1
    assert conv.active_offer is not None
    assert conv.active_offer.offerStatus == OfferStatus.ACTIVE
    assert conv.active_offer.revisedPricePerUnit == 235.0


def test_scenario_02_offer_expiry_is_later_than_creation(clean_agent: ClientAssistantAgent):
    """Scenario 2: Offer expiry is strictly later than offer creation time and in the future."""
    req = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        conversationId="CONV-SCEN-02",
        message="Can you reduce the price?",
    )
    clean_agent.process_chat_message(req)
    conv = clean_agent.conversation_repo.get("CONV-SCEN-02", tenant_id="tenant_default")
    offer = conv.active_offer
    assert offer is not None

    created_dt = datetime.fromisoformat(offer.createdAt)
    expires_dt = datetime.fromisoformat(offer.expiresAt)

    assert expires_dt > created_dt
    assert expires_dt > datetime.now()
    assert (expires_dt - created_dt).days >= 14


def test_scenario_03_customer_requests_exact_existing_offer_price(clean_agent: ClientAssistantAgent):
    """Scenario 3: Customer requests the exact existing offer price."""
    # Step 1: Initial discount creates offer at ₹235
    req1 = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        conversationId="CONV-SCEN-03",
        message="Can you reduce the price?",
    )
    clean_agent.process_chat_message(req1)

    # Step 2: Customer asks for ₹235 (exact match)
    req2 = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        conversationId="CONV-SCEN-03",
        message="Can you do ₹235 per unit?",
    )
    resp2 = clean_agent.process_chat_message(req2)
    assert resp2.customerResponse.revisedPricePerUnit == 235.0
    msg = resp2.customerResponse.message
    assert "Our current revised offer is ₹235.00 per unit" in msg
    assert "Please let us know if you would like to accept this offer" in msg


def test_scenario_04_exact_price_counter_does_not_duplicate_offer(clean_agent: ClientAssistantAgent):
    """Scenario 4: Exact-price counter-offer does not create a duplicate offer."""
    # Step 1: Offer at ₹235
    req1 = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        conversationId="CONV-SCEN-04",
        message="Can you reduce the price?",
    )
    resp1 = clean_agent.process_chat_message(req1)
    offer_id_1 = resp1.customerResponse.offerId
    expiry_1 = resp1.customerResponse.offerExpiresAt

    # Step 2: Exact counter at ₹235
    req2 = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        conversationId="CONV-SCEN-04",
        message="The maximum we can pay is ₹235 per unit.",
    )
    resp2 = clean_agent.process_chat_message(req2)

    conv = clean_agent.conversation_repo.get("CONV-SCEN-04", tenant_id="tenant_default")
    assert len(conv.offers) == 1
    assert resp2.customerResponse.offerId == offer_id_1
    assert resp2.customerResponse.offerExpiresAt == expiry_1


def test_scenario_05_customer_accepts_valid_offer(clean_agent: ClientAssistantAgent):
    """Scenario 5: Customer accepts a valid active commercial offer."""
    clean_agent.process_chat_message(ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        conversationId="CONV-SCEN-05",
        message="Can you reduce the price?",
    ))

    req_accept = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        conversationId="CONV-SCEN-05",
        message="We accept your revised offer of ₹235 per unit. Please proceed.",
    )
    resp = clean_agent.process_chat_message(req_accept)
    assert resp.negotiationStatus == NegotiationStatus.CUSTOMER_ACCEPTED
    conv = clean_agent.conversation_repo.get("CONV-SCEN-05", tenant_id="tenant_default")
    assert conv.active_offer.offerStatus == OfferStatus.ACCEPTED


def test_scenario_06_customer_attempts_to_accept_expired_offer(clean_agent: ClientAssistantAgent):
    """Scenario 6: Customer attempts to accept an expired offer."""
    clean_agent.process_chat_message(ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        conversationId="CONV-SCEN-06",
        message="Can you reduce the price?",
    ))
    conv = clean_agent.conversation_repo.get("CONV-SCEN-06", tenant_id="tenant_default")

    # Simulate expired offer
    conv.active_offer.expiresAt = (datetime.now() - timedelta(days=2)).isoformat()
    conv.active_offer.offerStatus = OfferStatus.EXPIRED

    req_accept = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        conversationId="CONV-SCEN-06",
        message="We accept the rate. Please proceed.",
    )
    resp = clean_agent.process_chat_message(req_accept)
    assert resp.negotiationStatus == NegotiationStatus.OFFER_EXPIRED
    assert conv.active_offer.offerStatus == OfferStatus.EXPIRED
    assert "expired" in resp.customerResponse.message.lower()


def test_scenario_07_customer_accepts_offer_from_different_quotation(clean_agent: ClientAssistantAgent):
    """Scenario 7: Customer attempts to accept an offer belonging to another quotation."""
    conv = clean_agent.conversation_repo.get_or_create(
        conversation_id="CONV-SCEN-07",
        tenant_id="tenant_default",
        customer_id=4,
        quotation_id="QT-103",
        original_price_per_unit=250.0,
        minimum_authorized_price=235.0,
    )
    # Manually attach offer belonging to QT-999
    conv.create_offer(
        offer_id="OFFER-FOREIGN",
        quotation_id="QT-999-MISMATCH",
        original_price=250.0,
        revised_price=235.0,
        quantity=500,
        validity_days=15,
    )

    req_accept = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        conversationId="CONV-SCEN-07",
        message="We accept your offer. Please proceed.",
    )
    resp = clean_agent.process_chat_message(req_accept)
    assert resp.negotiationStatus != NegotiationStatus.CUSTOMER_ACCEPTED
    assert "different quotation" in resp.customerResponse.message.lower()


def test_scenario_08_customer_facing_response_does_not_expose_internal_data(clean_agent: ClientAssistantAgent):
    """Scenario 8: Customer-facing response does not expose internal pricing data."""
    payload = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        conversationId="CONV-SCEN-08",
        message="Can you give us a discount?",
    )
    # Customer chat call (without staff role)
    resp = client_assistant_chat(payload=payload, agent=clean_agent)
    assert isinstance(resp, ClientAssistantCustomerResponse)
    dumped = resp.model_dump()
    assert "minimumAuthorizedPrice" not in dumped
    assert "productionCostPerUnit" not in dumped
    assert "internalMetadata" not in dumped
    cust_view_dump = resp.customerResponse.model_dump()
    assert "minimumAuthorizedPrice" not in cust_view_dump
    assert "productionCostPerUnit" not in cust_view_dump


def test_scenario_09_alternatives_correctly_compare_prices(clean_agent: ClientAssistantAgent):
    """Scenario 9: Alternatives correctly compare prices with the current active offer."""
    q = clean_agent.customer_service.get_quotation_for_customer("QT-103", customer_id=4, tenant_id="tenant_default")
    profile = clean_agent.customer_service.get_customer_profile(4)

    # Active offer is ₹235.00
    alts = clean_agent.alternative_service.generate_alternatives(
        quotation=q,
        customer_profile=profile,
        current_offer_price=235.0,
    )
    assert len(alts) >= 3

    for alt in alts:
        assert alt.differenceFromCurrentOfferINR is not None
        assert alt.differenceFromOriginalQuotationINR is not None
        assert alt.totalOrderAmountINR is not None
        # Check calculation consistency: differenceFromCurrentOffer = proposed - 235
        expected_diff = round(alt.proposedPricePerUnit - 235.0, 2)
        assert abs(alt.differenceFromCurrentOfferINR - expected_diff) < 0.01

        # If proposed price is >= current offer, savings vs current offer must be 0 and not claim cheaper
        if alt.proposedPricePerUnit >= 235.0:
            assert alt.savingsVsCurrentOfferINR == 0.0
            assert "cheaper" not in alt.description.lower()
        else:
            assert alt.savingsVsCurrentOfferINR > 0.0


def test_scenario_10_tax_unavailable_does_not_claim_tax_inclusive(clean_agent: ClientAssistantAgent):
    """Scenario 10: Tax-unavailable case returns TAX_NOT_CALCULATED and does not claim tax-inclusive."""
    # Seed QT-103 benchmark quotation has totalTax = 0 / None
    req = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        conversationId="CONV-SCEN-10",
        message="Can you reduce the price?",
    )
    resp = clean_agent.process_chat_message(req)
    assert resp.customerResponse.taxStatus == "TAX_NOT_CALCULATED"
    assert resp.customerResponse.taxAmount is None
    assert resp.customerResponse.finalPayableAmount is None
    assert resp.customerResponse.finalQuotationTotalWithTax is None
    assert "not calculated" in resp.customerResponse.message.lower()


def test_scenario_11_sales_order_failure_does_not_produce_false_confirmation(clean_agent: ClientAssistantAgent):
    """Scenario 11: Sales-order creation failure produces pending message without false order confirmation."""
    clean_agent.process_chat_message(ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        conversationId="CONV-SCEN-11",
        message="Can you reduce the price?",
    ))

    req_accept_fail = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        conversationId="CONV-SCEN-11",
        message="We accept your offer.",
        additionalContext={"simulateOrderFailure": True},
    )
    resp = clean_agent.process_chat_message(req_accept_fail)
    assert resp.negotiationStatus == NegotiationStatus.CUSTOMER_ACCEPTED
    assert resp.salesOrderId is None
    assert resp.orderCreationStatus == "PENDING_CONFIRMATION"

    # Message must NOT claim production is scheduled or order finalized
    assert "awaiting formal confirmation" in resp.customerResponse.message.lower()
    assert "order has been created and confirmed" not in resp.customerResponse.message.lower()


def test_scenario_12_successful_sales_order_returns_actual_order_id(clean_agent: ClientAssistantAgent):
    """Scenario 12: Successful sales-order creation returns the actual order ID and confirms creation."""
    clean_agent.process_chat_message(ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        conversationId="CONV-SCEN-12",
        message="Can you reduce the price?",
    ))

    req_accept_success = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        conversationId="CONV-SCEN-12",
        message="We accept your revised offer of ₹235 per unit. Please proceed.",
    )
    resp = clean_agent.process_chat_message(req_accept_success)
    assert resp.negotiationStatus == NegotiationStatus.CUSTOMER_ACCEPTED
    assert resp.salesOrderId is not None
    assert resp.orderCreationStatus == "CREATED"
    assert "created and confirmed" in resp.customerResponse.message.lower()

