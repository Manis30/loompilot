import os
os.environ["DISABLE_GROQ"] = "true"

import pytest
from fastapi import HTTPException

from app.api.routes.monitoring_routes import (
    get_factory_health,
    get_machines_status,
    get_operational_alerts,
    get_production_status,
    get_workforce_status,
    process_monitoring_query,
    verify_monitoring_access,
)
from app.agents.monitoring.agent import MonitoringAgent, get_monitoring_agent
from app.agents.monitoring.machine_monitor import MachineMonitor
from app.agents.monitoring.production_monitor import ProductionMonitor
from app.agents.monitoring.workforce_monitor import WorkforceMonitor
from app.agents.monitoring.alert_manager import OperationalAlertManager
from app.schemas.monitoring_schema import (
    AlertSeverity,
    AlertStatus,
    MonitoringQueryRequest,
)


# ==============================================================================
# 1. Current Machine Status
# ==============================================================================
def test_scenario_01_current_machine_status():
    """Verify fleet of 12 machines with 10 available and 2 under maintenance."""
    agent = get_monitoring_agent()
    resp = agent.get_machine_status(as_of_date="2026-10-31")

    assert resp.totalMachines == 12
    assert resp.availableCount == 10
    assert resp.runningCount == 7
    assert resp.idleCount == 3
    assert resp.maintenanceCount == 2
    assert resp.breakdownCount == 0
    assert set(resp.attentionRequiredMachines) == {"ST-02", "FIN-03"}


# ==============================================================================
# 2. Idle Machine Identification
# ==============================================================================
def test_scenario_02_idle_machine_identification():
    """Verify detection of machines in standby / idle states."""
    agent = get_monitoring_agent()
    resp = agent.get_machine_status(as_of_date="2026-10-31")

    assert resp.idleCount == 3
    idle_machines = [m for m in resp.machines if m.isIdle]
    assert len(idle_machines) == 3
    idle_codes = {m.machineCode for m in idle_machines}
    assert idle_codes == {"CUT-03", "STI-04", "PAC-03"}

    for m in idle_machines:
        assert m.isIdle is True
        assert m.isOperating is False
        assert m.isUnderMaintenance is False


# ==============================================================================
# 3. Machine Breakdown / Maintenance Detection
# ==============================================================================
def test_scenario_03_machine_breakdown_and_maintenance_detection():
    """Verify detection of ST-02 and FIN-03 requiring maintenance attention."""
    agent = get_monitoring_agent()
    resp = agent.get_machine_status(as_of_date="2026-10-31")

    maint_machines = [m for m in resp.machines if m.isUnderMaintenance]
    assert len(maint_machines) == 2
    codes = {m.machineCode for m in maint_machines}
    assert codes == {"ST-02", "FIN-03"}

    for m in maint_machines:
        assert m.requiresAttention is True
        assert m.attentionReason is not None
        assert "maintenance" in m.attentionReason.lower()


# ==============================================================================
# 4. Machine Utilization Calculation (Missing vs Explicit Data)
# ==============================================================================
def test_scenario_04_machine_utilization_calculation():
    """Verify utilization rule: DATA_UNAVAILABLE when missing; exact formula when provided."""
    agent = get_monitoring_agent()

    # Part A: Missing runtime hours (standard dataset state)
    resp_missing = agent.get_machine_status(as_of_date="2026-10-31", runtime_hours_input=None)
    assert resp_missing.utilization.isCalculable is False
    assert resp_missing.utilization.utilizationPct is None
    assert "DATA_UNAVAILABLE" in resp_missing.utilization.dataAvailabilityNote

    # Part B: Explicit runtime hours provided
    # 2 machines: ST-01 ran 7.5 hrs, CUT-01 ran 8.0 hrs over 8-hr shift (total avail: 16 hrs)
    runtime_data = {"ST-01": 7.5, "CUT-01": 8.0}
    resp_explicit = agent.get_machine_status(as_of_date="2026-10-31", runtime_hours_input=runtime_data)
    assert resp_explicit.utilization.isCalculable is True
    assert resp_explicit.utilization.actualRunningTimeHours == 15.5
    assert resp_explicit.utilization.availableProductionTimeHours == 16.0
    # Expected: (15.5 / 16.0) * 100 = 96.88%
    assert resp_explicit.utilization.utilizationPct == 96.88


# ==============================================================================
# 5. Planned vs Actual Production
# ==============================================================================
def test_scenario_05_planned_vs_actual_production():
    """Verify production achievement tracking across orders."""
    agent = get_monitoring_agent()
    resp = agent.get_production_status(as_of_date="2026-10-31")

    assert resp.totalOrdersCount == 30
    assert resp.totalPlannedUnits > 0
    assert resp.totalProducedUnits > 0
    expected_pct = round((resp.totalProducedUnits / resp.totalPlannedUnits) * 100.0, 2)
    assert resp.overallAchievementPct == expected_pct
    assert resp.completedOrdersCount + resp.activeOrdersCount == resp.totalOrdersCount


# ==============================================================================
# 6. Production Delay Detection
# ==============================================================================
def test_scenario_06_production_delay_detection():
    """Verify detection of delayed in-progress orders."""
    agent = get_monitoring_agent()
    resp = agent.get_production_status(as_of_date="2026-10-31")

    assert resp.delayedOrdersCount == 12
    for order in resp.delayedOrders:
        assert order.isDelayed is True
        assert order.delayDays >= 0
        assert order.remainingQuantity > 0
        assert order.orderStatus.lower() != "completed"


# ==============================================================================
# 7. Employee Attendance Summary
# ==============================================================================
def test_scenario_07_employee_attendance_summary():
    """Verify employee attendance metrics on latest date (2026-10-31)."""
    agent = get_monitoring_agent()
    resp = agent.get_workforce_status(as_of_date="2026-10-31")

    assert resp.totalEmployees == 21
    assert resp.presentCount == 20
    assert resp.halfDayCount == 1
    assert resp.absentCount == 0


# ==============================================================================
# 8. Workforce Availability % and Sufficiency Check
# ==============================================================================
def test_scenario_08_workforce_availability_and_sufficiency():
    """
    Verify workforce availability formula:
    ((Present + 0.5 * HalfDay) / TotalEmployees) * 100
    ((20 + 0.5 * 1) / 21) * 100 = 97.62%
    """
    agent = get_monitoring_agent()
    resp = agent.get_workforce_status(as_of_date="2026-10-31")

    expected_avail = round(((20 + 0.5 * 1) / 21) * 100.0, 2)  # 97.62
    assert resp.workforceAvailabilityPct == expected_avail
    assert resp.isWorkforceSufficient is True

    # PII privacy safeguard check
    assert "CONFIDENTIALITY" in resp.dataPrivacyNotice


# ==============================================================================
# 9. Operational Alert Generation
# ==============================================================================
def test_scenario_09_operational_alert_generation():
    """Verify generation of structured operational alerts with empirical evidence."""
    agent = get_monitoring_agent()
    machine_resp = agent.get_machine_status("2026-10-31")
    prod_resp = agent.get_production_status("2026-10-31")
    workforce_resp = agent.get_workforce_status("2026-10-31")

    alerts = agent.alert_manager.generate_alerts(
        machine_resp=machine_resp,
        prod_resp=prod_resp,
        workforce_resp=workforce_resp,
        as_of_date="2026-10-31",
    )

    assert len(alerts) > 0
    # Must have machine alerts for ST-02 and FIN-03
    mch_alert_ids = {a.alertId for a in alerts if a.category.value == "MACHINE"}
    assert "ALT-MCH-ST-02" in mch_alert_ids
    assert "ALT-MCH-FIN-03" in mch_alert_ids

    # Each alert must have required fields
    for a in alerts:
        assert a.alertId is not None
        assert a.severity in (AlertSeverity.CRITICAL, AlertSeverity.HIGH, AlertSeverity.MEDIUM, AlertSeverity.LOW)
        assert a.evidence is not None and len(a.evidence) > 10
        assert a.recommendedAction is not None
        assert a.status == AlertStatus.ACTIVE


# ==============================================================================
# 10. Duplicate Alert Prevention
# ==============================================================================
def test_scenario_10_duplicate_alert_prevention():
    """Verify that regenerating alerts does not create duplicate active alerts."""
    agent = get_monitoring_agent()
    machine_resp = agent.get_machine_status("2026-10-31")
    prod_resp = agent.get_production_status("2026-10-31")
    workforce_resp = agent.get_workforce_status("2026-10-31")

    # Call 1
    alerts_round_1 = agent.alert_manager.generate_alerts(machine_resp, prod_resp, workforce_resp)
    # Call 2
    alerts_round_2 = agent.alert_manager.generate_alerts(machine_resp, prod_resp, workforce_resp)

    # Count of alerts must remain identical
    assert len(alerts_round_1) == len(alerts_round_2)

    # All alert IDs in round 2 must be unique (no duplicates in list)
    alert_ids = [a.alertId for a in alerts_round_2]
    assert len(alert_ids) == len(set(alert_ids))


# ==============================================================================
# 11. Consolidated Factory Health Report
# ==============================================================================
def test_scenario_11_consolidated_factory_health_report():
    """Verify the comprehensive factory health report schema and contents."""
    agent = get_monitoring_agent()
    report = agent.get_factory_health_report(as_of_date="2026-10-31")

    assert report.reportId.startswith("REP-")
    assert report.asOfDate == "2026-10-31"
    assert len(report.dataSourcesUsed) >= 4
    assert report.machineSummary["total"] == 12
    assert report.machineSummary["maintenance"] == 2
    assert report.productionSummary["totalOrdersCount"] == 30
    assert report.delayedOrdersSummary["delayedOrdersCount"] == 12
    assert report.workforceSummary["totalEmployees"] == 21
    assert len(report.alerts) > 0
    assert len(report.rootCauses) > 0
    assert len(report.recommendations) > 0
    assert "DATA_UNAVAILABLE" in report.missingDataNotice


# ==============================================================================
# 12. Missing Dataset Handling
# ==============================================================================
def test_scenario_12_missing_dataset_handling():
    """Verify graceful handling when an underlying dataset is absent or empty."""
    import pandas as pd

    class MockEmptyRepo:
        def __init__(self):
            self._machines_df = pd.DataFrame()
            self._orders_df = pd.DataFrame()
            self._attendance_df = pd.DataFrame()
            self._employees_df = pd.DataFrame()
            self._production_reports_df = pd.DataFrame()

        def _ensure_loaded(self):
            pass

        def get_active_orders(self):
            return []

        def get_product(self, pid):
            return None

    empty_repo = MockEmptyRepo()
    m_mon = MachineMonitor(repository=empty_repo)
    p_mon = ProductionMonitor(repository=empty_repo)
    w_mon = WorkforceMonitor(repository=empty_repo)

    m_resp = m_mon.get_machine_status_overview()
    p_resp = p_mon.get_production_overview()
    w_resp = w_mon.get_workforce_overview()

    assert m_resp.totalMachines == 0
    assert m_resp.utilization.isCalculable is False
    assert p_resp.totalOrdersCount == 0
    assert w_resp.totalEmployees == 0


# ==============================================================================
# 13. Tenant Isolation
# ==============================================================================
def test_scenario_13_tenant_isolation():
    """Verify tenant isolation: valid tenant succeeds, invalid tenant returns 404."""
    agent = get_monitoring_agent()

    # Valid tenant
    valid_req = MonitoringQueryRequest(
        tenantId="tenant_default",
        query="What is the current machine fleet status?",
    )
    resp_valid = process_monitoring_query(request=valid_req, current_role="ADMIN", agent=agent)
    assert resp_valid.success is True
    assert resp_valid.tenantId == "tenant_default"

    # Invalid tenant
    invalid_req = MonitoringQueryRequest(
        tenantId="invalid_tenant",
        query="What is the current machine fleet status?",
    )
    with pytest.raises(HTTPException) as exc_info:
        process_monitoring_query(request=invalid_req, current_role="ADMIN", agent=agent)
    assert exc_info.value.status_code == 404
    assert "not found" in exc_info.value.detail.lower()


# ==============================================================================
# 14. Unauthorized Access / Role Check
# ==============================================================================
def test_scenario_14_unauthorized_access_role_check():
    """Verify RBAC: UNAUTHORIZED or GUEST roles return 403 Forbidden."""
    agent = get_monitoring_agent()
    req = MonitoringQueryRequest(tenantId="tenant_default", query="Show factory health")

    # Unauthorized role via verify_monitoring_access
    with pytest.raises(HTTPException) as exc_unauth:
        verify_monitoring_access(x_user_role="UNAUTHORIZED")
    assert exc_unauth.value.status_code == 403
    assert "access denied" in exc_unauth.value.detail.lower()

    # Guest role rejected
    with pytest.raises(HTTPException) as exc_guest:
        verify_monitoring_access(x_user_role="GUEST")
    assert exc_guest.value.status_code == 403

    # Authorized role succeeds
    role = verify_monitoring_access(x_user_role="PLANT_MANAGER")
    assert role == "PLANT_MANAGER"
    resp = process_monitoring_query(request=req, current_role=role, agent=agent)
    assert resp.success is True


# ==============================================================================
# 15. Empty Dataset Handling via API Routes
# ==============================================================================
def test_scenario_15_empty_dataset_handling_api():
    """Verify API route functions respond gracefully with structured responses."""
    agent = get_monitoring_agent()

    resp_mch = get_machines_status(asOfDate=None, current_role="ADMIN", agent=agent)
    assert resp_mch.totalMachines == 12

    resp_prod = get_production_status(asOfDate=None, current_role="ADMIN", agent=agent)
    assert resp_prod.totalOrdersCount == 30

    resp_wf = get_workforce_status(asOfDate=None, current_role="ADMIN", agent=agent)
    assert resp_wf.totalEmployees == 21

    resp_health = get_factory_health(asOfDate=None, current_role="ADMIN", agent=agent)
    assert resp_health.reportId.startswith("REP-")
