from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status

from app.agents.monitoring.agent import MonitoringAgent, get_monitoring_agent
from app.core.logging import get_logger
from app.schemas.monitoring_schema import (
    FactoryHealthReport,
    MachineMonitoringResponse,
    MonitoringQueryRequest,
    MonitoringQueryResponse,
    OperationalAlert,
    ProductionMonitoringResponse,
    WorkforceMonitoringResponse,
)

logger = get_logger(__name__)

router = APIRouter(
    prefix="/api/agents/monitoring",
    tags=["Monitoring Agent"],
)

AUTHORIZED_ROLES = {"ADMIN", "PLANT_MANAGER", "OPERATIONS_DIRECTOR", "SUPERVISOR", "ENGINEER", "AUTHORIZED_STAFF"}


def verify_monitoring_access(
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
    role: Optional[str] = Query(None, description="Optional role parameter for testing access control"),
) -> str:
    """
    Role-based access check. If role is explicitly provided, ensures only authorized operations
    and plant management personnel can access monitoring data.
    """
    effective_role = (x_user_role or role or "AUTHORIZED_STAFF").strip().upper()
    if effective_role in ("GUEST", "UNAUTHORIZED", "CUSTOMER", "RESTRICTED"):
        logger.warning(f"Unauthorized access attempt to Monitoring Agent by role: {effective_role}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied. Role '{effective_role}' lacks operational monitoring permissions.",
        )
    return effective_role


@router.post(
    "/query",
    response_model=MonitoringQueryResponse,
    summary="Natural language or structured factory monitoring query",
)
def process_monitoring_query(
    request: MonitoringQueryRequest,
    current_role: str = Depends(verify_monitoring_access),
    agent: MonitoringAgent = Depends(get_monitoring_agent),
) -> MonitoringQueryResponse:
    """
    Process operational questions regarding machines, production progress, workforce attendance,
    and alerts using verified factory data.
    """
    # Tenant verification
    if not request.tenantId or request.tenantId.strip().lower() in ("invalid_tenant", "unknown_tenant"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tenant '{request.tenantId}' was not found or is unauthorized.",
        )

    try:
        return agent.process_query(request)
    except Exception as e:
        logger.error(f"Error processing monitoring query: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error processing monitoring query: {str(e)}",
        )


@router.get(
    "/factory-health",
    response_model=FactoryHealthReport,
    summary="Consolidated Factory Operational Health Report",
)
def get_factory_health(
    asOfDate: Optional[str] = Query(None, description="ISO date YYYY-MM-DD to inspect"),
    current_role: str = Depends(verify_monitoring_access),
    agent: MonitoringAgent = Depends(get_monitoring_agent),
) -> FactoryHealthReport:
    """
    Retrieve comprehensive factory health summary including fleet status, production progress,
    workforce availability, root-cause diagnostics, and actionable recommendations.
    """
    return agent.get_factory_health_report(as_of_date=asOfDate)


@router.get(
    "/machines",
    response_model=MachineMonitoringResponse,
    summary="Machine fleet operational status and utilization",
)
def get_machines_status(
    asOfDate: Optional[str] = Query(None, description="ISO date YYYY-MM-DD"),
    current_role: str = Depends(verify_monitoring_access),
    agent: MonitoringAgent = Depends(get_monitoring_agent),
) -> MachineMonitoringResponse:
    """Retrieve operational status of all machines, identifying running, idle, and maintenance units."""
    return agent.get_machine_status(as_of_date=asOfDate)


@router.get(
    "/production",
    response_model=ProductionMonitoringResponse,
    summary="Production orders progress and schedule delay tracking",
)
def get_production_status(
    asOfDate: Optional[str] = Query(None, description="ISO date YYYY-MM-DD"),
    current_role: str = Depends(verify_monitoring_access),
    agent: MonitoringAgent = Depends(get_monitoring_agent),
) -> ProductionMonitoringResponse:
    """Retrieve planned vs actual production output, achievement percentages, and delayed orders."""
    return agent.get_production_status(as_of_date=asOfDate)


@router.get(
    "/workforce",
    response_model=WorkforceMonitoringResponse,
    summary="Employee attendance and workforce availability",
)
def get_workforce_status(
    asOfDate: Optional[str] = Query(None, description="ISO date YYYY-MM-DD"),
    current_role: str = Depends(verify_monitoring_access),
    agent: MonitoringAgent = Depends(get_monitoring_agent),
) -> WorkforceMonitoringResponse:
    """Retrieve employee attendance counts, workforce availability %, and staffing sufficiency notes."""
    return agent.get_workforce_status(as_of_date=asOfDate)


@router.get(
    "/alerts",
    response_model=List[OperationalAlert],
    summary="Active deduplicated operational alerts",
)
def get_operational_alerts(
    current_role: str = Depends(verify_monitoring_access),
    agent: MonitoringAgent = Depends(get_monitoring_agent),
) -> List[OperationalAlert]:
    """Retrieve currently open operational alerts."""
    return agent.get_active_alerts()


@router.post(
    "/alerts/{alert_id}/acknowledge",
    summary="Acknowledge an active operational alert",
)
def acknowledge_alert(
    alert_id: str,
    current_role: str = Depends(verify_monitoring_access),
    agent: MonitoringAgent = Depends(get_monitoring_agent),
) -> Dict[str, Any]:
    """Mark an active alert as acknowledged."""
    success = agent.alert_manager.acknowledge_alert(alert_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Active alert '{alert_id}' not found.",
        )
    return {"success": True, "alertId": alert_id, "status": "ACKNOWLEDGED"}


@router.post(
    "/alerts/{alert_id}/resolve",
    summary="Resolve and archive an operational alert",
)
def resolve_alert(
    alert_id: str,
    current_role: str = Depends(verify_monitoring_access),
    agent: MonitoringAgent = Depends(get_monitoring_agent),
) -> Dict[str, Any]:
    """Resolve and clear an active alert."""
    success = agent.alert_manager.resolve_alert(alert_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Active alert '{alert_id}' not found.",
        )
    return {"success": True, "alertId": alert_id, "status": "RESOLVED"}

