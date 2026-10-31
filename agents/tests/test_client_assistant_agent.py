import pytest
from app.data.data_repository import DataRepository, get_data_repository
from app.agents.quotation.quotation_repository import QuotationRepository
from app.agents.client_assistant.agent import ClientAssistantAgent
from app.agents.client_assistant.customer_service import (
    CustomerNotFoundError,
    CustomerOwnershipError,
    CustomerService,
)
from app.agents.client_assistant.conversation_repository import ConversationRepository
from app.agents.client_assistant.bargaining_service import BargainingService
from app.agents.client_assistant.intent_classifier import IntentClassifier
from app.agents.client_assistant.objection_handler import ObjectionHandler
from app.agents.client_assistant.alternative_service import AlternativeService
from app.schemas.client_assistant_schema import (
    ClientAssistantChatRequest,
    CustomerIntent,
    NegotiationStatus,
)


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
# 1. Customer Verification & Profiling Tests
# ==============================================================================
def test_customer_profiling(clean_agent: ClientAssistantAgent):
    """Customer profile correctly loads Client 4 (UrbanThread Fashion) with history."""
    profile = clean_agent.customer_service.get_customer_profile(4)
    assert profile.customerId == 4
    assert profile.customerName == "UrbanThread Fashion"
    assert profile.city == "Hyderabad"
    assert profile.email == "urbanthread@example.com"
    assert profile.totalOrdersCount > 0
    assert profile.totalSpendINR > 0
    assert profile.maxDiscretionaryDiscountPct > 0


def test_customer_not_found(clean_agent: ClientAssistantAgent):
    """Querying non-existent customer raises CustomerNotFoundError."""
    with pytest.raises(CustomerNotFoundError):
        clean_agent.customer_service.get_customer_profile(99999)


# ==============================================================================
# 2. Quotation Ownership & Tenant Isolation Tests
# ==============================================================================
def test_quotation_ownership_validation(clean_agent: ClientAssistantAgent):
    """Client cannot negotiate a quotation belonging to another customer."""
    # Seed QT-103 which belongs to Customer 4
    clean_agent.customer_service.get_quotation_for_customer("QT-103", customer_id=4)

    # Customer 1 attempts to access Customer 4's quotation
    with pytest.raises(CustomerOwnershipError):
        clean_agent.customer_service.get_quotation_for_customer(
            quotation_identifier="QT-103",
            customer_id=1,
            tenant_id="tenant_default",
        )


def test_tenant_isolation(clean_agent: ClientAssistantAgent):
    """Cross-tenant quotation access is rejected."""
    with pytest.raises(PermissionError):
        clean_agent.customer_service.get_quotation_for_customer(
            quotation_identifier="QT-103",
            customer_id=4,
            tenant_id="tenant_unauthorized_999",
        )


# ==============================================================================
# 3. Intent Classification & Entity Extraction Tests
# ==============================================================================
def test_intent_classification():
    classifier = IntentClassifier()

    intent, entities = classifier.classify_and_extract("Your quotation is expensive. Can you reduce the price?", 250.0)
    assert intent == CustomerIntent.DISCOUNT_REQUEST

    intent, entities = classifier.classify_and_extract("Your quotation is too expensive.", 250.0)
    assert intent == CustomerIntent.PRICE_OBJECTION

    intent, entities = classifier.classify_and_extract("Can you do ₹225 per unit?", 250.0)
    assert intent == CustomerIntent.COUNTER_OFFER
    assert entities.get("targetPrice") == 225.0

    intent, entities = classifier.classify_and_extract("When can you deliver this order?", 250.0)
    assert intent == CustomerIntent.DELIVERY_QUERY

    intent, entities = classifier.classify_and_extract("What are your credit payment terms?", 250.0)
    assert intent == CustomerIntent.PAYMENT_QUERY

    intent, entities = classifier.classify_and_extract("Can we use an alternative fabric blend?", 250.0)
    assert intent == CustomerIntent.PRODUCT_CHANGE_REQUEST

    intent, entities = classifier.classify_and_extract("We accept the quote, let's proceed.", 250.0)
    assert intent == CustomerIntent.ACCEPTANCE

    intent, entities = classifier.classify_and_extract("We decline this quote and will cancel.", 250.0)
    assert intent == CustomerIntent.REJECTION


# ==============================================================================
# 4. Bargaining & Pricing Rules Tests (QT-103 Benchmark)
# ==============================================================================
def test_initial_discount_request(clean_agent: ClientAssistantAgent):
    """
    Step 1: Customer requests discount without a target price.
    Agent offers a discretionary concession within authorized limits.
    """
    req = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        conversationId="CONV-TEST-01",
        message="Your quotation is expensive. Can you reduce the price?",
    )
    resp = clean_agent.process_chat_message(req)

    assert resp.success is True
    assert resp.intent == CustomerIntent.DISCOUNT_REQUEST
    assert resp.originalPricePerUnit == 250.0
    assert resp.minimumAuthorizedPrice == 235.0
    assert resp.currentOfferPerUnit <= 250.0
    assert resp.currentOfferPerUnit >= 235.0
    assert resp.requiresApproval is False
    assert resp.pendingApprovalId is None
    assert resp.negotiationStatus in (NegotiationStatus.OFFER_MADE, NegotiationStatus.IN_PROGRESS)
    # Ensure floor price is not leaked in customer message
    assert "minimum authorized" not in resp.response.lower()
    assert "floor price" not in resp.response.lower()


def test_counter_offer_below_floor_requires_approval(clean_agent: ClientAssistantAgent):
    """
    Step 2: Customer offers ₹225, which is BELOW the ₹235 minimum authorized floor.
    Agent MUST NOT accept ₹225 automatically, holds floor at ₹235, and escalates for approval.
    """
    req = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        conversationId="CONV-TEST-02",
        message="Can you do ₹225 per unit?",
    )
    resp = clean_agent.process_chat_message(req)

    assert resp.success is True
    assert resp.intent == CustomerIntent.COUNTER_OFFER
    assert resp.customerTargetPrice == 225.0
    assert resp.minimumAuthorizedPrice == 235.0
    assert resp.currentOfferPerUnit == 235.0  # Holds authorized floor
    assert resp.requiresApproval is True
    assert resp.pendingApprovalId is not None
    assert resp.negotiationStatus == NegotiationStatus.PENDING_APPROVAL
    # Feasibility alternatives should be generated
    assert resp.suggestedAlternatives is not None
    assert len(resp.suggestedAlternatives) > 0


def test_human_approval_decision(clean_agent: ClientAssistantAgent):
    """
    Manager officially approves an escalated discount request.
    Conversation transitions to APPROVED and current offer updates to approved price.
    """
    req = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        conversationId="CONV-TEST-03",
        message="Can you do ₹225 per unit?",
    )
    resp = clean_agent.process_chat_message(req)
    approval_id = resp.pendingApprovalId
    assert approval_id is not None

    # Executive manager approves the exception
    decision_resp = clean_agent.decide_approval(
        approval_id=approval_id,
        authorized_by="GeneralManager_Priya",
        decision="APPROVE",
        approved_price_per_unit=225.0,
        notes="Approved for high-volume annual partnership.",
        tenant_id="tenant_default",
    )

    assert decision_resp.success is True
    assert decision_resp.status == "APPROVED"
    assert decision_resp.effectivePricePerUnit == 225.0

    # Verify conversation state is updated
    conv = clean_agent.get_conversation("CONV-TEST-03", tenant_id="tenant_default")
    assert conv.negotiationStatus == NegotiationStatus.APPROVED
    assert conv.currentOfferPerUnit == 225.0
    assert conv.requiresApproval is False


def test_customer_acceptance(clean_agent: ClientAssistantAgent):
    """Customer accepts the deal."""
    req = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        conversationId="CONV-TEST-04",
        message="We accept the offered rate. Let's proceed with the order.",
    )
    resp = clean_agent.process_chat_message(req)
    assert resp.intent == CustomerIntent.ACCEPTANCE
    assert resp.negotiationStatus == NegotiationStatus.CUSTOMER_ACCEPTED


def test_customer_declines(clean_agent: ClientAssistantAgent):
    """Customer explicitly walks away."""
    req = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        conversationId="CONV-TEST-05",
        message="The price is still too high. We will look elsewhere, please cancel.",
    )
    resp = clean_agent.process_chat_message(req)
    assert resp.intent == CustomerIntent.REJECTION
    assert resp.negotiationStatus == NegotiationStatus.CUSTOMER_DECLINED


# ==============================================================================
# 5. Dataset Quotation Retrieval Tests
# ==============================================================================
def test_retrieve_dataset_quotation(clean_agent: ClientAssistantAgent):
    """Agent can negotiate historical quotations from LoomPilot_Quotations dataset."""
    # Quotation 1 belongs to Client 1 (Apex Apparel)
    profile = clean_agent.customer_service.get_customer_profile(1)
    assert profile.companyName == "Apex Apparel"

    req = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=1,
        quotationId="QT-2026-001",
        conversationId="CONV-HIST-01",
        message="What is the delivery timeline for this quotation?",
    )
    resp = clean_agent.process_chat_message(req)
    assert resp.success is True
    assert resp.intent == CustomerIntent.DELIVERY_QUERY
    assert resp.originalPricePerUnit > 0

