from typing import Any, Dict, List, Optional, Union
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status

from app.core.logging import get_logger
from app.data.data_repository import DataRepository, get_data_repository
from app.agents.quotation.quotation_repository import QuotationNotFoundError
from app.agents.client_assistant.agent import ClientAssistantAgent, get_client_assistant_agent
from app.agents.client_assistant.customer_service import (
    CustomerNotFoundError,
    CustomerOwnershipError,
)
from app.agents.client_assistant.conversation_repository import (
    ApprovalNotFoundError,
    ConversationNotFoundError,
)
from app.schemas.client_assistant_schema import (
    AlternativesRequest,
    AlternativesResponse,
    ClientAssistantChatRequest,
    ClientAssistantChatResponse,
    ClientAssistantCustomerResponse,
    ClientAssistantInternalResponse,
    ConversationDetailResponse,
    ConversationListResponse,
    HumanApprovalDecisionRequest,
    HumanApprovalResponse,
    PendingApprovalsListResponse,
)

logger = get_logger(__name__)

router = APIRouter(prefix="/api/agents/client-assistant", tags=["Client Assistant AI Agent"])


@router.post(
    "",
    response_model=Union[ClientAssistantCustomerResponse, ClientAssistantInternalResponse],
    summary="Customer chat and price bargaining (alias)",
    include_in_schema=False,
)
@router.post(
    "/chat",
    response_model=Union[ClientAssistantCustomerResponse, ClientAssistantInternalResponse],
    summary="Customer chat and price bargaining",
    description=(
        "Processes customer natural-language messages regarding quotations and orders. "
        "Separates customer-facing presentation from internal negotiation metadata. "
        "Authorized staff members can supply X-Staff-Role or include_internal=true to inspect internal metadata."
    ),
    status_code=status.HTTP_200_OK,
)
def client_assistant_chat(
    payload: ClientAssistantChatRequest,
    agent: ClientAssistantAgent = Depends(get_client_assistant_agent),
    x_staff_role: Optional[str] = Header(None, alias="X-Staff-Role"),
    x_internal_access: Optional[bool] = Header(None, alias="X-Internal-Access"),
    include_internal: Optional[bool] = Query(None, description="Include internal metadata (requires staff authorization)"),
) -> Union[ClientAssistantCustomerResponse, ClientAssistantInternalResponse]:
    """Core chat and negotiation endpoint."""
    is_staff = False
    if x_staff_role and str(x_staff_role).lower() in ("staff", "manager", "admin", "sales_manager", "internal"):
        is_staff = True
    elif x_internal_access is True:
        is_staff = True
    elif include_internal is True:
        is_staff = True

    try:
        return agent.process_chat_message(payload, include_internal=is_staff)
    except CustomerNotFoundError as e:
        logger.warning(f"Customer not found in client assistant chat: {e}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "CustomerNotFoundError", "message": str(e)},
        )
    except QuotationNotFoundError as e:
        logger.warning(f"Quotation not found in client assistant chat: {e}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "QuotationNotFoundError", "message": str(e)},
        )
    except CustomerOwnershipError as e:
        logger.warning(f"Quotation ownership violation in chat: {e}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "CustomerOwnershipError", "message": str(e)},
        )
    except PermissionError as e:
        logger.warning(f"Tenant isolation error in chat: {e}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "TenantAccessError", "message": str(e)},
        )
    except ValueError as e:
        logger.warning(f"Validation error in chat: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "ValueError", "message": str(e)},
        )
    except Exception as e:
        logger.error(f"Unexpected error in client assistant chat: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An internal error occurred while processing customer negotiation: {str(e)}",
        )


@router.get(
    "/conversations/{conversationId}",
    response_model=ConversationDetailResponse,
    summary="Retrieve negotiation conversation thread",
    description="Fetch complete message history and current negotiation state with multi-tenant isolation.",
    status_code=status.HTTP_200_OK,
)
def get_conversation_by_id(
    conversationId: str,
    tenantId: Optional[str] = None,
    agent: ClientAssistantAgent = Depends(get_client_assistant_agent),
) -> ConversationDetailResponse:
    """Retrieve conversation details."""
    try:
        t_id = tenantId or "tenant_default"
        return agent.get_conversation(conversation_id=conversationId, tenant_id=t_id)
    except ConversationNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "ConversationNotFoundError", "message": str(e)},
        )
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "TenantAccessError", "message": str(e)},
        )


@router.get(
    "/conversations",
    response_model=ConversationListResponse,
    summary="List negotiation conversations",
    description="Query active and past negotiation threads filtered by tenant and optional customer.",
    status_code=status.HTTP_200_OK,
)
def list_conversations(
    tenantId: Optional[str] = None,
    customerId: Optional[int] = None,
    agent: ClientAssistantAgent = Depends(get_client_assistant_agent),
) -> ConversationListResponse:
    """List conversations endpoint."""
    t_id = tenantId or "tenant_default"
    convs = agent.list_conversations(tenant_id=t_id, customer_id=customerId)
    return ConversationListResponse(
        success=True,
        agent="client_assistant_agent",
        totalCount=len(convs),
        conversations=convs,
    )


@router.get(
    "/approvals/pending",
    response_model=PendingApprovalsListResponse,
    summary="List pending human approval escalations",
    description="Retrieve pricing or term exception requests requiring executive authorization.",
    status_code=status.HTTP_200_OK,
)
def list_pending_approvals(
    tenantId: Optional[str] = None,
    agent: ClientAssistantAgent = Depends(get_client_assistant_agent),
) -> PendingApprovalsListResponse:
    """List pending approvals."""
    t_id = tenantId or "tenant_default"
    approvals = agent.list_pending_approvals(tenant_id=t_id)
    return PendingApprovalsListResponse(
        success=True,
        agent="client_assistant_agent",
        totalCount=len(approvals),
        pendingApprovals=approvals,
    )


@router.post(
    "/approvals/{approvalId}/decide",
    response_model=HumanApprovalResponse,
    summary="Record managerial approval decision",
    description=(
        "Records executive manager decision ('APPROVE' or 'REJECT') on an escalated negotiation discount. "
        "The AI agent cannot approve its own commercial exceptions."
    ),
    status_code=status.HTTP_200_OK,
)
def decide_approval(
    approvalId: str,
    payload: HumanApprovalDecisionRequest,
    agent: ClientAssistantAgent = Depends(get_client_assistant_agent),
) -> HumanApprovalResponse:
    """Approve or reject escalated discount."""
    try:
        return agent.decide_approval(
            approval_id=approvalId,
            authorized_by=payload.authorizedBy,
            decision=payload.decision,
            approved_price_per_unit=payload.approvedPricePerUnit,
            notes=payload.notes,
            tenant_id=payload.tenantId,
        )
    except ApprovalNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "ApprovalNotFoundError", "message": str(e)},
        )
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "TenantAccessError", "message": str(e)},
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "ValueError", "message": str(e)},
        )


@router.post(
    "/alternatives",
    response_model=AlternativesResponse,
    summary="Generate feasibility-backed order alternatives",
    description=(
        "Evaluates volume tiering, alternative fabric specifications, and schedule adjustments "
        "when a customer's target price cannot be achieved. Validated through the Feasibility Agent."
    ),
    status_code=status.HTTP_200_OK,
)
def generate_order_alternatives(
    payload: AlternativesRequest,
    agent: ClientAssistantAgent = Depends(get_client_assistant_agent),
) -> AlternativesResponse:
    """Generate alternatives endpoint."""
    try:
        return agent.get_alternatives(
            tenant_id=payload.tenantId,
            customer_id=payload.customerId,
            quotation_id=payload.quotationId,
            target_price=payload.targetPricePerUnit,
        )
    except CustomerNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "CustomerNotFoundError", "message": str(e)},
        )
    except QuotationNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "QuotationNotFoundError", "message": str(e)},
        )
    except CustomerOwnershipError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "CustomerOwnershipError", "message": str(e)},
        )
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "TenantAccessError", "message": str(e)},
        )


@router.get(
    "/health",
    summary="Client Assistant Agent health check",
    description="Returns operational readiness and dataset connectivity status for the Client Assistant Agent.",
    status_code=status.HTTP_200_OK,
)
def client_assistant_health_check(
    agent: ClientAssistantAgent = Depends(get_client_assistant_agent),
    repository: DataRepository = Depends(get_data_repository),
) -> Dict[str, Any]:
    """Health check for Client Assistant Agent."""
    return {
        "status": "healthy",
        "agent": "client_assistant_agent",
        "role": "B2B Manufacturing Sales Representative & Bargaining Assistant",
        "datasetsLoaded": repository._is_loaded,
        "totalClients": len(repository._clients_df) if repository._clients_df is not None else 0,
        "totalOrders": len(repository._orders_df) if repository._orders_df is not None else 0,
        "totalQuotations": len(repository._quotations_df) if repository._quotations_df is not None else 0,
        "activeConversationsCount": len(agent.list_conversations()),
        "pendingApprovalsCount": len(agent.list_pending_approvals()),
        "supportedIntents": [
            "GENERAL_QUERY",
            "PRICE_OBJECTION",
            "DISCOUNT_REQUEST",
            "COUNTER_OFFER",
            "DELIVERY_QUERY",
            "PAYMENT_QUERY",
            "PRODUCT_CHANGE_REQUEST",
            "ACCEPTANCE",
            "REJECTION",
        ],
        "bargainingGovernance": {
            "floorPriceCalculation": "max(ProductionCost * 1.08, OriginalPrice * 0.88)",
            "autonomousDiscountAuthority": "Tier-based (2.0% - 6.0%)",
            "managerApprovalRequired": "Discounts above tier limit or below factory floor",
            "confidentialityPreserved": "Internal cost breakdown and floor price never revealed to customer",
        },
    }

