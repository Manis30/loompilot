from datetime import date
import pytest
from fastapi import HTTPException

from app.api.routes.feasibility_routes import (
    evaluate_order_feasibility,
    feasibility_health_check,
    list_orders,
)
from app.agents.feasibility.agent import FeasibilityAgent
from app.data.data_repository import DataRepository
from app.schemas.feasibility_schema import (
    FeasibilityEvaluationRequest,
    FeasibilityEvaluationResponse,
)


@pytest.fixture
def agent(real_repository: DataRepository) -> FeasibilityAgent:
    return FeasibilityAgent(repository=real_repository)


def test_feasibility_health_endpoint(real_repository: DataRepository):
    """Test health check route returns operational counts."""
    data = feasibility_health_check(repository=real_repository)
    assert data["status"] == "healthy"
    assert data["agent"] == "feasibility_agent"
    assert data["datasetsLoaded"] is True
    assert data["totalOrdersAvailable"] == 30
    assert data["activeOrdersCount"] == 15
    assert data["totalProducts"] == 7
    assert data["totalMachines"] == 12


def test_feasibility_list_orders_endpoint(real_repository: DataRepository):
    """Test listing orders with and without status filter."""
    # All orders
    all_data = list_orders(status_filter="all", repository=real_repository)
    assert all_data["success"] is True
    assert all_data["totalOrders"] == 30

    # In progress filter
    in_prog_data = list_orders(status_filter="In Progress", repository=real_repository)
    assert in_prog_data["success"] is True
    assert in_prog_data["totalOrders"] == 15


def test_evaluate_order_route_success(agent: FeasibilityAgent):
    """Test POST /evaluate route with valid order payload."""
    payload = FeasibilityEvaluationRequest(
        tenantId="tenant_default",
        orderId="LP-2026-001",
        orderQuantity=500,
        requiredDeliveryDate=date(2026, 11, 20),
        evaluationDate=date(2026, 10, 30),
    )
    resp = evaluate_order_feasibility(payload=payload, agent=agent)
    assert isinstance(resp, FeasibilityEvaluationResponse)
    assert resp.success is True
    assert resp.orderId == "LP-2026-001"
    assert resp.assessmentStatus in ["FEASIBLE", "CONDITIONALLY_FEASIBLE"]
    assert resp.earliestFeasibleDeliveryDate is not None


def test_evaluate_order_route_not_found(agent: FeasibilityAgent):
    """Test POST /evaluate with non-existent order raises 404 HTTPException."""
    payload = FeasibilityEvaluationRequest(
        tenantId="tenant_default",
        orderId="ORD-NON-EXISTENT-9999",
    )
    with pytest.raises(HTTPException) as exc_info:
        evaluate_order_feasibility(payload=payload, agent=agent)
    assert exc_info.value.status_code == 404


def test_evaluate_order_route_tenant_validation(agent: FeasibilityAgent):
    """Test POST /evaluate with blank tenantId raises 400 or 422 error."""
    with pytest.raises((HTTPException, ValueError)):
        evaluate_order_feasibility(
            payload=FeasibilityEvaluationRequest(
                tenantId="",
                orderId="ORD-001",
            ),
            agent=agent,
        )


def test_evaluate_order_simulation_mode(agent: FeasibilityAgent):
    """Test POST /evaluate with new simulated order (not currently in orders database)."""
    payload = FeasibilityEvaluationRequest(
        tenantId="tenant_default",
        orderId="SIM-2026-NEW-999",
        productId=2,  # Polo Shirt
        orderQuantity=350,
        requiredDeliveryDate=date(2026, 11, 25),
        evaluationDate=date(2026, 10, 30),
    )
    resp = evaluate_order_feasibility(payload=payload, agent=agent)
    assert resp.success is True
    assert resp.orderNumber == "SIM-2026-NEW-999"
    assert resp.productName == "Polo Shirt"
    assert resp.orderQuantity == 350
    assert resp.earliestFeasibleDeliveryDate is not None

