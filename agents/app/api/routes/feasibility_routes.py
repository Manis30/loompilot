from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.logging import get_logger
from app.data.data_repository import (
    DataRepository,
    OrderNotFoundError,
    ProductNotFoundError,
    get_data_repository,
)
from app.agents.feasibility.agent import FeasibilityAgent, get_feasibility_agent
from app.schemas.feasibility_schema import (
    FeasibilityEvaluationRequest,
    FeasibilityEvaluationResponse,
)

logger = get_logger(__name__)

router = APIRouter(prefix="/api/agents/feasibility", tags=["Feasibility AI Agent"])


@router.post(
    "/evaluate",
    response_model=FeasibilityEvaluationResponse,
    summary="Evaluate manufacturing order feasibility",
    description=(
        "Performs an end-to-end manufacturing feasibility assessment for an existing or newly submitted client order. "
        "Evaluates product BOM requirements, material inventory balances, dynamic order commitments, "
        "machine capacity and downtime, workforce attendance, and production sequencing to determine "
        "whether the order can be delivered by the requested deadline. Calculates the earliest realistic "
        "feasible delivery date and provides plain-language executive reasoning and practical recommendations."
    ),
    status_code=status.HTTP_200_OK,
)
def evaluate_order_feasibility(
    payload: FeasibilityEvaluationRequest,
    agent: FeasibilityAgent = Depends(get_feasibility_agent),
) -> FeasibilityEvaluationResponse:
    """Evaluate feasibility endpoint."""
    try:
        return agent.evaluate_order(payload)
    except OrderNotFoundError as e:
        logger.warning(f"Order not found: {e}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "OrderNotFoundError", "message": str(e)},
        )
    except ProductNotFoundError as e:
        logger.warning(f"Product not found: {e}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "ProductNotFoundError", "message": str(e)},
        )
    except ValueError as e:
        logger.warning(f"Validation error in feasibility evaluation: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "ValueError", "message": str(e)},
        )
    except Exception as e:
        logger.error(f"Unexpected error in /evaluate endpoint: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal server error occurred while evaluating manufacturing feasibility.",
        )


@router.get(
    "/health",
    summary="Feasibility Agent health check",
    description="Returns the operational readiness and repository initialization status of the Feasibility AI Agent.",
    status_code=status.HTTP_200_OK,
)
def feasibility_health_check(
    repository: DataRepository = Depends(get_data_repository),
) -> Dict[str, Any]:
    """Health check for Feasibility Agent."""
    all_orders = repository.get_all_orders()
    active_orders = repository.get_active_orders()
    all_products = repository.get_all_products()
    all_machines = repository.get_all_machines()

    return {
        "status": "healthy",
        "agent": "feasibility_agent",
        "datasetsLoaded": True,
        "totalOrdersAvailable": len(all_orders),
        "activeOrdersCount": len(active_orders),
        "totalProducts": len(all_products),
        "totalMachines": len(all_machines),
    }


@router.get(
    "/orders",
    summary="List available manufacturing orders for evaluation",
    description="Returns catalog of manufacturing orders present in repository, useful for exploratory assessment.",
    status_code=status.HTTP_200_OK,
)
def list_orders(
    status_filter: str = Query(default="all", description="Filter orders by status: 'all', 'In Progress', or 'Completed'"),
    repository: DataRepository = Depends(get_data_repository),
) -> Dict[str, Any]:
    """List orders endpoint."""
    orders = repository.get_all_orders()
    if status_filter.lower() != "all":
        orders = [o for o in orders if str(o.get("OrderStatus", "")).lower() == status_filter.lower()]

    return {
        "success": True,
        "totalOrders": len(orders),
        "orders": [
            {
                "orderId": o.get("OrderID"),
                "orderNumber": o.get("OrderNumber"),
                "productId": o.get("ProductID"),
                "orderQuantity": o.get("OrderQuantity"),
                "orderStatus": o.get("OrderStatus"),
                "remainingQuantity": o.get("RemainingQuantity"),
                "requiredDeliveryDate": o.get("RequiredDeliveryDate"),
            }
            for o in orders
        ],
    }

