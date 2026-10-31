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
from app.agents.client_assistant.agent import ClientAssistantAgent
from app.schemas.client_assistant_schema import (
    ClientAssistantChatRequest,
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
    return ClientAssistantAgent(
        repository=repo,
        quotation_repo=q_repo,
        conversation_repo=c_repo,
        customer_service=cust_service,
        bargaining_service=bargaining_service,
        intent_classifier=intent_classifier,
        objection_handler=objection_handler,
        alternative_service=alt_service,
    )


# ==============================================================================
# 10 Specification Scenarios from Section 12
# ==============================================================================

def test_scenario_1_unspecified_discount_request(clean_agent: ClientAssistantAgent):
    """
    Scenario 1: Customer asks for a discount without specifying a number.
    "Your quotation is expensive. Can you reduce the price?"
    Expected outcome:
    - Offers ₹235 (6% discount).
    - Quantity 500, orig total ₹125,000, revised total ₹117,500, savings ₹7,500.
    - Validity 15 days, status OFFER_MADE, requiresApproval = false.
    - Customer view does NOT expose minimumAuthorizedPrice or productionCostPerUnit.
    - No unsupported claims ("precision stitching", "export-grade packaging").
    """
    req = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        conversationId="CONV-SCENARIO-1",
        message="Your quotation is expensive. Can you reduce the price?",
    )
    resp = clean_agent.process_chat_message(req)
    assert resp.success is True
    assert resp.negotiationStatus == NegotiationStatus.OFFER_MADE
    assert resp.currentOfferPerUnit == 235.0
    assert resp.customerResponse.originalPricePerUnit == 250.0
    assert resp.customerResponse.revisedPricePerUnit == 235.0
    assert resp.customerResponse.orderQuantity == 500
    assert resp.customerResponse.originalQuotationTotal == 125000.0
    assert resp.customerResponse.revisedQuotationTotal == 117500.0
    assert resp.customerResponse.totalSavings == 7500.0
    assert resp.customerResponse.discountPercentage == 6.0
    assert resp.customerResponse.offerId is not None
    assert resp.customerResponse.offerExpiresAt is not None
    assert resp.requiresApproval is False

    # Protection of internal pricing info
    cust_dict = resp.customerResponse.model_dump()
    assert "minimumAuthorizedPrice" not in cust_dict
    assert "productionCostPerUnit" not in cust_dict
    assert resp.internalMetadata.minimumAuthorizedPrice == 235.0
    assert resp.internalMetadata.pricingValidationStatus == "VALID"

    # Unsupported claims prevented
    msg_lower = resp.customerResponse.message.lower()
    assert "precision stitching" not in msg_lower
    assert "export-grade packaging" not in msg_lower


def test_scenario_2_counter_within_floor(clean_agent: ClientAssistantAgent):
    """
    Scenario 2: Customer counters with an acceptable price within the floor.
    "Can you do ₹240 per unit?"
    Expected outcome:
    - ₹240 >= minimum authorized price (₹235), agent accepts and offers ₹240.
    - No escalation required. Status = OFFER_MADE.
    """
    req = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        conversationId="CONV-SCENARIO-2",
        message="Can you do ₹240 per unit?",
    )
    resp = clean_agent.process_chat_message(req)
    assert resp.success is True
    assert resp.negotiationStatus == NegotiationStatus.OFFER_MADE
    assert resp.currentOfferPerUnit == 240.0
    assert resp.requiresApproval is False
    assert resp.customerResponse.revisedPricePerUnit == 240.0
    assert resp.customerResponse.revisedQuotationTotal == 120000.0
    assert resp.customerResponse.totalSavings == 5000.0
    assert resp.customerResponse.discountPercentage == 4.0


def test_scenario_3_counter_exact_floor(clean_agent: ClientAssistantAgent):
    """
    Scenario 3: Customer counters with the exact floor price.
    "The maximum we can pay is ₹235 per unit."
    Expected outcome:
    - Target price = ₹235 equals floor price.
    - Agent accepts and offers ₹235. Status = OFFER_MADE.
    """
    req = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        conversationId="CONV-SCENARIO-3",
        message="The maximum we can pay is ₹235 per unit.",
    )
    resp = clean_agent.process_chat_message(req)
    assert resp.success is True
    assert resp.negotiationStatus == NegotiationStatus.OFFER_MADE
    assert resp.currentOfferPerUnit == 235.0
    assert resp.requiresApproval is False
    assert resp.customerResponse.revisedPricePerUnit == 235.0
    assert resp.customerResponse.revisedQuotationTotal == 117500.0
    assert resp.customerResponse.totalSavings == 7500.0
    assert resp.customerResponse.discountPercentage == 6.0


def test_scenario_4_counter_below_floor_requires_approval(clean_agent: ClientAssistantAgent):
    """
    Scenario 4: Customer counters below the floor price.
    "We received an offer from another supplier at ₹220 per unit. Can you match it?"
    Expected outcome:
    - Target price = ₹220 < floor price ₹235.
    - Agent does NOT accept ₹220, maintains current floor (₹235).
    - requiresApproval = true, status = PENDING_APPROVAL.
    - Informs customer that price has been submitted to management for review.
    """
    req = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        conversationId="CONV-SCENARIO-4",
        message="We received an offer from another supplier at ₹220 per unit. Can you match it?",
    )
    resp = clean_agent.process_chat_message(req)
    assert resp.success is True
    assert resp.negotiationStatus == NegotiationStatus.PENDING_APPROVAL
    assert resp.requiresApproval is True
    assert resp.currentOfferPerUnit == 235.0
    assert resp.pendingApprovalId is not None
    assert resp.internalMetadata.requiresApproval is True
    assert resp.internalMetadata.customerTargetPrice == 220.0
    msg_lower = resp.customerResponse.message.lower()
    assert "submitted" in msg_lower or "management" in msg_lower


def test_scenario_5_cumulative_discount_prevention(clean_agent: ClientAssistantAgent):
    """
    Scenario 5: Customer asks for another discount after already receiving ₹235.
    "Can you reduce it by another ₹10?"
    Expected outcome:
    - Target price = ₹225 is below floor.
    - Agent does NOT grant further discount.
    - Explains ₹235 is the best authorized price, offers alternatives or escalates.
    """
    # Step 1: Initial discount to ₹235
    req1 = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        conversationId="CONV-SCENARIO-5",
        message="Your quotation is expensive. Can you reduce the price?",
    )
    resp1 = clean_agent.process_chat_message(req1)
    assert resp1.currentOfferPerUnit == 235.0

    # Step 2: Cumulative reduction attempt
    req2 = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        conversationId="CONV-SCENARIO-5",
        message="Can you reduce it by another ₹10?",
    )
    resp2 = clean_agent.process_chat_message(req2)
    assert resp2.currentOfferPerUnit == 235.0
    assert resp2.customerResponse.revisedPricePerUnit == 235.0
    assert resp2.requiresApproval is True


def test_scenario_6_customer_acceptance(clean_agent: ClientAssistantAgent):
    """
    Scenario 6: Customer accepts the offer.
    "We accept your revised offer of ₹235 per unit. Please proceed."
    Expected outcome:
    - Status = CUSTOMER_ACCEPTED.
    - Locks the offer, updates quotation status to APPROVED.
    """
    # Initial offer
    clean_agent.process_chat_message(ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        conversationId="CONV-SCENARIO-6",
        message="Can you reduce the price?",
    ))
    # Customer accepts
    req_accept = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        conversationId="CONV-SCENARIO-6",
        message="We accept your revised offer of ₹235 per unit. Please proceed.",
    )
    resp = clean_agent.process_chat_message(req_accept)
    assert resp.success is True
    assert resp.negotiationStatus == NegotiationStatus.CUSTOMER_ACCEPTED
    q = clean_agent.quotation_repo.get("QT-103", tenant_id="tenant_default")
    assert q.status == QuotationStatus.APPROVED


def test_scenario_7_customer_declines(clean_agent: ClientAssistantAgent):
    """
    Scenario 7: Customer declines the offer.
    "The price is still too high. We will look elsewhere."
    Expected outcome:
    - Status = CUSTOMER_DECLINED.
    - Professional response proposing alternatives.
    """
    req = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        conversationId="CONV-SCENARIO-7",
        message="The price is still too high. We will look elsewhere.",
    )
    resp = clean_agent.process_chat_message(req)
    assert resp.success is True
    assert resp.negotiationStatus == NegotiationStatus.CUSTOMER_DECLINED
    assert "understand" in resp.customerResponse.message.lower()


def test_scenario_8_expired_quotation(clean_agent: ClientAssistantAgent):
    """
    Scenario 8: Customer tries to negotiate on an expired quotation.
    Expected outcome:
    - Agent detects expiration before negotiating.
    - Does NOT negotiate on the expired quotation.
    - Informs customer quotation expired and offers to prepare a refreshed quotation.
    """
    q = clean_agent.customer_service.get_quotation_for_customer("QT-103", customer_id=4, tenant_id="tenant_default")
    q_expired = q.model_copy(deep=True)
    q_expired.quotationId = "QT-EXPIRED-99"
    q_expired.quotationNumber = "LP-QT-EXPIRED-99"
    q_expired.status = QuotationStatus.EXPIRED
    q_expired.validUntil = "2025-01-01"
    clean_agent.quotation_repo.save(q_expired)

    req = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-EXPIRED-99",
        conversationId="CONV-SCENARIO-8",
        message="Can you give us a discount on this quote?",
    )
    resp = clean_agent.process_chat_message(req)
    assert resp.internalMetadata.pricingValidationStatus == "EXPIRED_QUOTATION"
    assert resp.negotiationStatus == NegotiationStatus.CLOSED
    msg_lower = resp.customerResponse.message.lower()
    assert "expired" in msg_lower
    assert "refreshed" in msg_lower or "updated" in msg_lower


def test_scenario_9_missing_pricing_data(clean_agent: ClientAssistantAgent):
    """
    Scenario 9: Quotation record has missing pricing data.
    Expected outcome:
    - Agent detects missing financial data.
    - Does NOT generate arbitrary offer.
    - Flags pricingValidationStatus = MISSING_PRICING_DATA and escalates.
    """
    q = clean_agent.customer_service.get_quotation_for_customer("QT-103", customer_id=4, tenant_id="tenant_default")
    q_missing = q.model_copy(deep=True)
    q_missing.quotationId = "QT-MISSING-COST"
    q_missing.quotationNumber = "LP-QT-MISSING-COST"
    q_missing.financialSummary.sellingPricePerUnit = 0.0
    q_missing.financialSummary.finalQuotationAmount = 0.0
    q_missing.financialSummary.productionCostPerUnit = 0.0
    clean_agent.quotation_repo.save(q_missing)

    req = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-MISSING-COST",
        conversationId="CONV-SCENARIO-9",
        message="Can you offer a discount?",
    )
    resp = clean_agent.process_chat_message(req)
    assert resp.internalMetadata.pricingValidationStatus == "MISSING_PRICING_DATA"
    assert resp.requiresApproval is True
    assert "cost" in resp.customerResponse.message.lower()


def test_scenario_10_cost_inquiry(clean_agent: ClientAssistantAgent):
    """
    Scenario 10: Customer asks for the internal cost breakdown and profit margin.
    "Can you provide the complete cost breakdown including your profit margin?"
    Expected outcome:
    - Classified as CustomerIntent.COST_INQUIRY.
    - Explains manufacturing components transparently without exposing factory costs or margins.
    - Reaffirms competitive value.
    """
    req = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        conversationId="CONV-SCENARIO-10",
        message="Can you provide the complete cost breakdown including your profit margin?",
    )
    resp = clean_agent.process_chat_message(req)
    assert resp.success is True
    assert resp.intent == CustomerIntent.COST_INQUIRY
    msg_lower = resp.customerResponse.message.lower()
    assert "confidential" in msg_lower or "proprietary" in msg_lower
    # Strictly confidential: factory direct production cost (215) must not be revealed
    assert "215" not in resp.customerResponse.message


def test_expired_offer_acceptance_blocked(clean_agent: ClientAssistantAgent):
    """
    Improvement 4: Expired offer acceptance must be blocked.
    If the customer attempts to accept an expired offer, reject acceptance,
    explain expiration, and offer to refresh the quotation.
    """
    req1 = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        conversationId="CONV-EXPIRED-OFFER",
        message="Can you reduce the price?",
    )
    resp1 = clean_agent.process_chat_message(req1)
    conv = clean_agent.conversation_repo.get("CONV-EXPIRED-OFFER", tenant_id="tenant_default")
    assert conv.active_offer is not None

    # Simulate expired offer
    conv.active_offer.expiresAt = (datetime.now() - timedelta(days=2)).isoformat()
    conv.active_offer.offerStatus = OfferStatus.EXPIRED

    req_accept = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        conversationId="CONV-EXPIRED-OFFER",
        message="We accept your revised offer of ₹235 per unit. Please proceed.",
    )
    resp2 = clean_agent.process_chat_message(req_accept)
    assert resp2.negotiationStatus != NegotiationStatus.CUSTOMER_ACCEPTED
    assert "expired" in resp2.customerResponse.message.lower()

