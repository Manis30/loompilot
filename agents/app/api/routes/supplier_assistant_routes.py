from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.logging import get_logger
from app.schemas.supplier_assistant_schema import (
    ProcurementBenchmark,
    SupplierApprovalDecisionRequest,
    SupplierApprovalView,
    SupplierChatRequest,
    SupplierChatResponse,
)
from app.agents.supplier_assistant.agent import (
    MaterialSupplierAssistantAgent,
    get_material_supplier_assistant_agent,
)

logger = get_logger(__name__)

router = APIRouter(
    prefix="/api/agents/supplier-assistant",
    tags=["Material Supplier Assistant Agent"],
)


@router.post(
    "",
    response_model=SupplierChatResponse,
    summary="Chat and negotiate commercial terms with raw material supplier (alias)",
    include_in_schema=False,
)
@router.post(
    "/chat",
    response_model=SupplierChatResponse,
    summary="Chat and negotiate commercial terms with raw material supplier",
)
def chat_with_supplier(
    request: SupplierChatRequest,
    agent: MaterialSupplierAssistantAgent = Depends(get_material_supplier_assistant_agent),
) -> SupplierChatResponse:
    """
    Endpoint for B2B supplier interactions.
    Handles quote submissions, price spikes, bulk discounts, payment terms,
    quality validations, counter-offers, and formal acceptances.
    """
    try:
        response = agent.process_chat(request)
        return response
    except Exception as e:
        logger.error(f"Error processing supplier negotiation chat: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Supplier negotiation processing error: {str(e)}",
        )


@router.get(
    "/materials/{material_id}/procurement-benchmark",
    response_model=ProcurementBenchmark,
    summary="Retrieve verified procurement benchmarks and inventory metrics",
)
def get_procurement_benchmark(
    material_id: str,
    agent: MaterialSupplierAssistantAgent = Depends(get_material_supplier_assistant_agent),
) -> ProcurementBenchmark:
    """
    Retrieve market spot rate, historical purchase rate, stock availability,
    and target price bounds for raw material procurement planning.
    """
    try:
        return agent.get_procurement_benchmark(material_id)
    except Exception as e:
        logger.error(f"Failed to retrieve procurement benchmark for '{material_id}': {e}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Material '{material_id}' not found in procurement catalog.",
        )


@router.get(
    "/approvals/pending",
    response_model=List[SupplierApprovalView],
    summary="List pending procurement approval requests",
)
def list_pending_supplier_approvals(
    agent: MaterialSupplierAssistantAgent = Depends(get_material_supplier_assistant_agent),
) -> List[SupplierApprovalView]:
    """Retrieve all supplier quotes requiring executive approval due to ceiling breaches."""
    return agent.conversation_repo.get_pending_approvals()


@router.post(
    "/approvals/{approval_id}/decide",
    response_model=SupplierApprovalView,
    summary="Decide on a pending procurement approval",
)
def decide_supplier_approval(
    approval_id: str,
    request: SupplierApprovalDecisionRequest,
    agent: MaterialSupplierAssistantAgent = Depends(get_material_supplier_assistant_agent),
) -> SupplierApprovalView:
    """Authorize or reject an escalated supplier purchase rate."""
    result = agent.conversation_repo.decide_approval(
        approval_id=approval_id,
        decision=request.decision,
        decided_by=request.decidedBy,
        authorized_price=request.authorizedPricePerUnit,
        notes=request.notes,
    )
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Procurement approval '{approval_id}' not found.",
        )
    return result


@router.get(
    "/conversations/{conversation_id}",
    summary="Retrieve full supplier conversation thread and status",
)
def get_supplier_conversation(
    conversation_id: str,
    agent: MaterialSupplierAssistantAgent = Depends(get_material_supplier_assistant_agent),
) -> Dict[str, Any]:
    """Retrieve persistent conversation messages, status, and active commercial offer."""
    conv = agent.conversation_repo.get(conversation_id)
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Supplier conversation '{conversation_id}' not found.",
        )
    return {
        "conversationId": conv.conversation_id,
        "supplierId": conv.supplier_id,
        "materialId": conv.material_id,
        "status": conv.status.value,
        "activeOffer": conv.active_offer.model_dump() if conv.active_offer else None,
        "messages": conv.messages,
        "updatedAt": conv.updated_at.isoformat(),
    }
