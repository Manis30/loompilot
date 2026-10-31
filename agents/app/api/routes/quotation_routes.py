from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status

from app.core.logging import get_logger
from app.data.data_repository import DataRepository, get_data_repository
from app.agents.quotation.agent import QuotationAgent, get_quotation_agent
from app.agents.quotation.validator import QuotationValidationError, TenantAccessError
from app.agents.quotation.quotation_repository import (
    QuotationNotFoundError,
    QuotationStateTransitionError,
)
from app.schemas.quotation_schema import (
    QuotationApprovalRequest,
    QuotationDetail,
    QuotationGenerationRequest,
    QuotationListResponse,
    QuotationRejectionRequest,
    QuotationResponse,
    QuotationStatus,
)

logger = get_logger(__name__)

router = APIRouter(prefix="/api/agents/quotation", tags=["Quotation AI Agent"])


@router.post(
    "/generate",
    response_model=QuotationResponse,
    summary="Generate detailed bottom-up manufacturing quotation",
    description=(
        "Executes a bottom-up manufacturing quotation for a customer order. "
        "Calculates raw material consumption (BOM with cutting wastage) priced via the Market Price Agent, "
        "direct labour costs by stage, machine operating expenses, indirect factory overhead, "
        "configurable markup/gross margin, and applicable statutory taxes. "
        "Returns a complete quotation breakdown with status READY_FOR_APPROVAL, PENDING_REVIEW, or PENDING_INFORMATION."
    ),
    status_code=status.HTTP_200_OK,
)
def generate_quotation(
    payload: QuotationGenerationRequest,
    agent: QuotationAgent = Depends(get_quotation_agent),
) -> QuotationResponse:
    """Generate quotation endpoint."""
    try:
        return agent.generate_quotation(payload)
    except TenantAccessError as e:
        logger.warning(f"Tenant isolation error in quotation generation: {e}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "TenantAccessError", "message": str(e)},
        )
    except QuotationValidationError as e:
        logger.warning(f"Validation error in quotation generation: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "QuotationValidationError", "message": str(e)},
        )
    except ValueError as e:
        logger.warning(f"Value error in quotation generation: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "ValueError", "message": str(e)},
        )
    except Exception as e:
        logger.error(f"Unexpected error in /generate quotation endpoint: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An internal error occurred while generating the manufacturing quotation: {str(e)}",
        )


@router.get(
    "",
    response_model=QuotationListResponse,
    summary="List manufacturing quotations",
    description="Query quotations filtered by tenant and optional status.",
    status_code=status.HTTP_200_OK,
)
def list_quotations(
    tenantId: Optional[str] = None,
    status: Optional[QuotationStatus] = None,
    agent: QuotationAgent = Depends(get_quotation_agent),
) -> QuotationListResponse:
    """List quotations endpoint."""
    t_id = None if not isinstance(tenantId, str) else tenantId
    s_filter = status if isinstance(status, QuotationStatus) else None
    quotations = agent.list_quotations(tenant_id=t_id, status=s_filter)
    return QuotationListResponse(
        success=True,
        agent="quotation_agent",
        totalCount=len(quotations),
        quotations=quotations,
    )


@router.get(
    "/health",
    summary="Quotation Agent health check",
    description="Returns operational readiness and dataset initialization status of the Quotation AI Agent.",
    status_code=status.HTTP_200_OK,
)
def quotation_health_check(
    agent: QuotationAgent = Depends(get_quotation_agent),
    repository: DataRepository = Depends(get_data_repository),
) -> Dict[str, Any]:
    """Health check for Quotation Agent."""
    return {
        "status": "healthy",
        "agent": "quotation_agent",
        "datasetsLoaded": repository._is_loaded,
        "totalProducts": len(repository.get_all_products()),
        "totalMaterials": len(repository.get_all_material_ids()),
        "totalClients": len(repository._clients_df) if repository._clients_df is not None else 0,
        "activeQuotationsCount": len(agent.list_quotations()),
        "supportedPricingMethods": ["MARKUP", "GROSS_MARGIN"],
        "costComponents": ["Raw Materials", "Direct Labour", "Machine Operations", "Overhead", "Taxes"],
    }


@router.get(
    "/{quotationId}",
    response_model=QuotationResponse,
    summary="Retrieve quotation details",
    description="Fetch a specific quotation by ID or quotation number with multi-tenant isolation.",
    status_code=status.HTTP_200_OK,
)
def get_quotation_by_id(
    quotationId: str,
    tenantId: Optional[str] = None,
    agent: QuotationAgent = Depends(get_quotation_agent),
) -> QuotationResponse:
    """Retrieve quotation by ID."""
    try:
        t_id = None if not isinstance(tenantId, str) else tenantId
        quotation = agent.get_quotation(quotationId, tenant_id=t_id)
        return QuotationResponse(
            success=True,
            agent="quotation_agent",
            quotation=quotation,
            message="Quotation retrieved successfully.",
        )
    except QuotationNotFoundError as e:
        logger.warning(f"Quotation not found: {e}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "QuotationNotFoundError", "message": str(e)},
        )
    except PermissionError as e:
        logger.warning(f"Tenant isolation permission error: {e}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "TenantAccessError", "message": str(e)},
        )


@router.post(
    "/{quotationId}/approve",
    response_model=QuotationResponse,
    summary="Authorize quotation approval",
    description=(
        "Records authorized executive approval for a quotation in READY_FOR_APPROVAL or PENDING_REVIEW state. "
        "Quotation moves to APPROVED state. The LLM cannot approve quotations automatically."
    ),
    status_code=status.HTTP_200_OK,
)
def approve_quotation(
    quotationId: str,
    payload: QuotationApprovalRequest,
    tenantId: Optional[str] = None,
    agent: QuotationAgent = Depends(get_quotation_agent),
) -> QuotationResponse:
    """Approve quotation endpoint."""
    try:
        t_id = None if not isinstance(tenantId, str) else tenantId
        updated = agent.approve_quotation(
            quotation_identifier=quotationId,
            authorized_by=payload.authorizedBy,
            approval_notes=payload.approvalNotes,
            tenant_id=t_id,
        )
        return QuotationResponse(
            success=True,
            agent="quotation_agent",
            quotation=updated,
            message=f"Quotation '{updated.quotationNumber}' officially approved by '{payload.authorizedBy}'.",
        )
    except QuotationNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "QuotationNotFoundError", "message": str(e)},
        )
    except QuotationStateTransitionError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "QuotationStateTransitionError", "message": str(e)},
        )
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "TenantAccessError", "message": str(e)},
        )


@router.post(
    "/{quotationId}/reject",
    response_model=QuotationResponse,
    summary="Record quotation rejection",
    description="Records management or customer rejection with explicit reasons. Moves status to REJECTED.",
    status_code=status.HTTP_200_OK,
)
def reject_quotation(
    quotationId: str,
    payload: QuotationRejectionRequest,
    tenantId: Optional[str] = None,
    agent: QuotationAgent = Depends(get_quotation_agent),
) -> QuotationResponse:
    """Reject quotation endpoint."""
    try:
        t_id = None if not isinstance(tenantId, str) else tenantId
        updated = agent.reject_quotation(
            quotation_identifier=quotationId,
            rejected_by=payload.rejectedBy,
            rejection_reason=payload.rejectionReason,
            tenant_id=t_id,
        )
        return QuotationResponse(
            success=True,
            agent="quotation_agent",
            quotation=updated,
            message=f"Quotation '{updated.quotationNumber}' rejected by '{payload.rejectedBy}'.",
        )
    except QuotationNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "QuotationNotFoundError", "message": str(e)},
        )
    except QuotationStateTransitionError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "QuotationStateTransitionError", "message": str(e)},
        )
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "TenantAccessError", "message": str(e)},
        )
