import pytest
from fastapi import HTTPException

from app.api.routes.client_assistant_routes import (
    client_assistant_chat,
    client_assistant_health_check,
    decide_approval,
    generate_order_alternatives,
    get_conversation_by_id,
    list_conversations,
    list_pending_approvals,
)
from app.agents.client_assistant.agent import ClientAssistantAgent
from app.agents.client_assistant.customer_service import CustomerService
from app.agents.client_assistant.conversation_repository import ConversationRepository
from app.agents.quotation.quotation_repository import QuotationRepository
from app.data.data_repository import DataRepository, get_data_repository
from app.schemas.client_assistant_schema import (
    AlternativesRequest,
    ClientAssistantChatRequest,
    CustomerIntent,
    HumanApprovalDecisionRequest,
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
    return ClientAssistantAgent(
        repository=repo,
        quotation_repo=q_repo,
        conversation_repo=c_repo,
        customer_service=cust_service,
    )


# ==============================================================================
# 1. Health & Discovery Route Tests
# ==============================================================================
def test_client_assistant_health_route(clean_agent: ClientAssistantAgent, repo: DataRepository):
    """Test health check route returns healthy status and metadata."""
    res = client_assistant_health_check(agent=clean_agent, repository=repo)
    assert res["status"] == "healthy"
    assert res["agent"] == "client_assistant_agent"
    assert res["datasetsLoaded"] is True
    assert "supportedIntents" in res
    assert "bargainingGovernance" in res


# ==============================================================================
# 2. Customer Chat & Bargaining Route Tests
# ==============================================================================
def test_chat_discount_request_route(clean_agent: ClientAssistantAgent):
    """
    Test POST /chat route with user prompt example:
    UrbanThread Fashion (Customer 4), QT-103, asking for discount.
    """
    payload = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        conversationId="CONV-ROUTE-01",
        message="Your quotation is expensive. Can you reduce the price?",
    )
    res = client_assistant_chat(payload=payload, agent=clean_agent, include_internal=True)

    assert res.success is True
    assert res.agent == "client_assistant_agent"
    assert res.conversationId == "CONV-ROUTE-01"
    assert res.customerId == 4
    assert res.quotationId == "QT-103"
    assert res.intent == CustomerIntent.DISCOUNT_REQUEST
    assert res.originalPricePerUnit == 250.0
    assert res.minimumAuthorizedPrice == 235.0
    assert res.currentOfferPerUnit <= 250.0
    assert res.currentOfferPerUnit >= 235.0
    assert res.requiresApproval is False
    assert len(res.response) > 20


def test_chat_counter_offer_below_floor_route(clean_agent: ClientAssistantAgent):
    """
    Test POST /chat route with counter-offer below floor price.
    Returns PENDING_APPROVAL and creates approval record.
    """
    payload = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        conversationId="CONV-ROUTE-02",
        message="Can you do ₹225 per unit?",
    )
    res = client_assistant_chat(payload=payload, agent=clean_agent, include_internal=True)

    assert res.success is True
    assert res.intent == CustomerIntent.COUNTER_OFFER
    assert res.negotiationStatus == NegotiationStatus.PENDING_APPROVAL
    assert res.customerTargetPrice == 225.0
    assert res.currentOfferPerUnit == 235.0
    assert res.requiresApproval is True
    assert res.pendingApprovalId is not None
    assert res.suggestedAlternatives is not None


# ==============================================================================
# 3. Security, Tenant Isolation, and Ownership Validations
# ==============================================================================
def test_chat_customer_not_found_route(clean_agent: ClientAssistantAgent):
    """POST /chat route raises 404 for unknown customer."""
    payload = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=99999,
        quotationId="QT-103",
        message="Hello",
    )
    with pytest.raises(HTTPException) as exc:
        client_assistant_chat(payload=payload, agent=clean_agent)
    assert exc.value.status_code == 404
    assert exc.value.detail["error"] == "CustomerNotFoundError"


def test_chat_quotation_not_found_route(clean_agent: ClientAssistantAgent):
    """POST /chat route raises 404 for unknown quotation."""
    payload = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-NONEXISTENT-999",
        message="Hello",
    )
    with pytest.raises(HTTPException) as exc:
        client_assistant_chat(payload=payload, agent=clean_agent)
    assert exc.value.status_code == 404
    assert exc.value.detail["error"] == "QuotationNotFoundError"


def test_chat_quotation_ownership_violation_route(clean_agent: ClientAssistantAgent):
    """POST /chat route raises 403 when customer tries to access another customer's quote."""
    # Seed QT-103 for Customer 4
    clean_agent.customer_service.get_quotation_for_customer("QT-103", customer_id=4)

    payload = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=1,
        quotationId="QT-103",
        message="Give me a discount",
    )
    with pytest.raises(HTTPException) as exc:
        client_assistant_chat(payload=payload, agent=clean_agent)
    assert exc.value.status_code == 403
    assert exc.value.detail["error"] == "CustomerOwnershipError"


# ==============================================================================
# 4. Conversation History & Approvals Management Routes
# ==============================================================================
def test_conversation_history_routes(clean_agent: ClientAssistantAgent):
    """Test conversation retrieval and list routes."""
    conv_id = "CONV-HIST-ROUTE"
    client_assistant_chat(
        payload=ClientAssistantChatRequest(
            tenantId="tenant_default",
            customerId=4,
            quotationId="QT-103",
            conversationId=conv_id,
            message="Initial query",
        ),
        agent=clean_agent,
    )

    # Get single conversation
    detail = get_conversation_by_id(conversationId=conv_id, tenantId="tenant_default", agent=clean_agent)
    assert detail.conversationId == conv_id
    assert detail.messageCount >= 2
    assert len(detail.messages) >= 2

    # List conversations
    conv_list = list_conversations(tenantId="tenant_default", customerId=4, agent=clean_agent)
    assert conv_list.totalCount >= 1


def test_pending_approvals_and_decision_routes(clean_agent: ClientAssistantAgent):
    """Test pending approvals query and decision routes."""
    # Trigger escalation
    chat_resp = client_assistant_chat(
        payload=ClientAssistantChatRequest(
            tenantId="tenant_default",
            customerId=4,
            quotationId="QT-103",
            conversationId="CONV-DECIDE-ROUTE",
            message="Target is ₹225 per unit",
        ),
        agent=clean_agent,
        include_internal=True,
    )
    app_id = chat_resp.pendingApprovalId
    assert app_id is not None

    # View pending approvals
    pending = list_pending_approvals(tenantId="tenant_default", agent=clean_agent)
    assert pending.totalCount >= 1
    assert any(a.approvalId == app_id for a in pending.pendingApprovals)

    # Manager approves
    dec_resp = decide_approval(
        approvalId=app_id,
        payload=HumanApprovalDecisionRequest(
            tenantId="tenant_default",
            authorizedBy="SalesHead_Ramesh",
            decision="APPROVE",
            approvedPricePerUnit=225.0,
            notes="Approved for volume commitment",
        ),
        agent=clean_agent,
    )
    assert dec_resp.success is True
    assert dec_resp.status == "APPROVED"
    assert dec_resp.effectivePricePerUnit == 225.0


def test_generate_alternatives_route(clean_agent: ClientAssistantAgent):
    """Test /alternatives route generates feasible suggestions."""
    payload = AlternativesRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        targetPricePerUnit=225.0,
    )
    res = generate_order_alternatives(payload=payload, agent=clean_agent)
    assert res.success is True
    assert len(res.alternatives) >= 2
    types = [a.type for a in res.alternatives]
    assert "VOLUME_TIER" in types
    assert "ALTERNATIVE_FABRIC" in types


def test_customer_facing_route_protects_internal_data(clean_agent: ClientAssistantAgent):
    """Customer-facing call (no staff auth) strictly returns customer-safe response without internal metadata."""
    payload = ClientAssistantChatRequest(
        tenantId="tenant_default",
        customerId=4,
        quotationId="QT-103",
        conversationId="CONV-CUSTOMER-SAFE",
        message="Can you give me a discount?",
    )
    res = client_assistant_chat(payload=payload, agent=clean_agent)
    assert res.success is True
    res_dict = res.model_dump()
    assert "minimumAuthorizedPrice" not in res_dict
    assert "productionCostPerUnit" not in res_dict
    assert "internalMetadata" not in res_dict
