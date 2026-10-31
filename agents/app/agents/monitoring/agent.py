from datetime import datetime, timezone
import re
from typing import Any, Dict, List, Optional

from app.agents.monitoring.alert_manager import OperationalAlertManager
from app.agents.monitoring.explanation_service import MonitoringExplanationService
from app.agents.monitoring.machine_monitor import MachineMonitor
from app.agents.monitoring.production_monitor import ProductionMonitor
from app.agents.monitoring.recommendation_engine import RecommendationEngine
from app.agents.monitoring.root_cause_analyzer import RootCauseAnalyzer
from app.agents.monitoring.workforce_monitor import WorkforceMonitor
from app.core.logging import get_logger
from app.data.data_repository import DataRepository, get_data_repository
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


class MonitoringAgent:
    """
    Intelligent factory operations monitoring assistant for LoomPilot.
    Provides deterministic fleet metrics, production tracking, workforce availability,
    deduplicated operational alerts, root-cause diagnostics, and actionable recommendations.
    """

    def __init__(
        self,
        repository: Optional[DataRepository] = None,
        machine_monitor: Optional[MachineMonitor] = None,
        production_monitor: Optional[ProductionMonitor] = None,
        workforce_monitor: Optional[WorkforceMonitor] = None,
        alert_manager: Optional[OperationalAlertManager] = None,
        root_cause_analyzer: Optional[RootCauseAnalyzer] = None,
        recommendation_engine: Optional[RecommendationEngine] = None,
        explanation_service: Optional[MonitoringExplanationService] = None,
    ):
        self.repository = repository or get_data_repository()
        self.machine_monitor = machine_monitor or MachineMonitor(self.repository)
        self.production_monitor = production_monitor or ProductionMonitor(self.repository)
        self.workforce_monitor = workforce_monitor or WorkforceMonitor(self.repository)
        self.alert_manager = alert_manager or OperationalAlertManager()
        self.root_cause_analyzer = root_cause_analyzer or RootCauseAnalyzer()
        self.recommendation_engine = recommendation_engine or RecommendationEngine()
        self.explanation_service = explanation_service or MonitoringExplanationService()

    def get_machine_status(
        self,
        as_of_date: Optional[str] = None,
        runtime_hours_input: Optional[Dict[str, float]] = None,
    ) -> MachineMonitoringResponse:
        """Evaluate status of all machines, running/idle counts, and utilization."""
        date_str = as_of_date or "2026-10-31"
        return self.machine_monitor.get_machine_status_overview(
            as_of_date=date_str,
            runtime_hours_input=runtime_hours_input,
        )

    def get_production_status(
        self,
        as_of_date: Optional[str] = None,
    ) -> ProductionMonitoringResponse:
        """Evaluate planned vs actual production, delayed orders, and bottleneck stages."""
        date_str = as_of_date or "2026-10-31"
        return self.production_monitor.get_production_overview(as_of_date=date_str)

    def get_workforce_status(
        self,
        as_of_date: Optional[str] = None,
    ) -> WorkforceMonitoringResponse:
        """Evaluate employee attendance, workforce availability %, and staffing sufficiency."""
        return self.workforce_monitor.get_workforce_overview(as_of_date=as_of_date)

    def get_active_alerts(self) -> List[OperationalAlert]:
        """Retrieve deduplicated active operational alerts."""
        return self.alert_manager.get_active_alerts()

    def get_factory_health_report(
        self,
        as_of_date: Optional[str] = None,
        runtime_hours_input: Optional[Dict[str, float]] = None,
    ) -> FactoryHealthReport:
        """
        Generate consolidated factory health report synthesizing machines, production,
        attendance, alerts, root causes, and advisory recommendations.
        """
        date_str = as_of_date or "2026-10-31"
        now_ts = datetime.now(timezone.utc).isoformat()

        # 1. Fetch domain monitors
        machine_resp = self.get_machine_status(date_str, runtime_hours_input)
        prod_resp = self.get_production_status(date_str)
        workforce_resp = self.get_workforce_status(date_str)

        # 2. Generate deduplicated alerts
        alerts = self.alert_manager.generate_alerts(
            machine_resp=machine_resp,
            prod_resp=prod_resp,
            workforce_resp=workforce_resp,
            as_of_date=date_str,
        )

        # 3. Analyze root causes and generate recommendations
        root_causes = self.root_cause_analyzer.analyze_causes(machine_resp, prod_resp, workforce_resp)
        recommendations = self.recommendation_engine.generate_recommendations(machine_resp, prod_resp, workforce_resp)

        # 4. Assess overall factory health
        critical_alerts_count = sum(1 for a in alerts if a.severity.value == "CRITICAL")
        if critical_alerts_count > 0 or prod_resp.delayedOrdersCount > 5:
            health_status = "NEEDS_ATTENTION" if prod_resp.delayedOrdersCount <= 10 else "DEGRADED"
        elif machine_resp.maintenanceCount > 0 or workforce_resp.workforceAvailabilityPct < 90.0:
            health_status = "ATTENTION_REQUIRED"
        else:
            health_status = "HEALTHY"

        missing_notices = [
            "Machine running time logs (operating meter hours / downtime tracking) are not recorded in factory datasets. "
            "Per platform governance, machine utilization is marked DATA_UNAVAILABLE rather than estimated."
        ]

        return FactoryHealthReport(
            reportId=f"REP-{date_str.replace('-', '')}-01",
            asOfTimestamp=now_ts,
            asOfDate=date_str,
            dataSourcesUsed=[
                "LoomPilot_Machines.xlsx",
                "LoomPilot_Orders.xlsx",
                "LoomPilot_Attendance.xlsx",
                "LoomPilot_Employees.xlsx",
                "LoomPilot_ProductionReports.xlsx",
            ],
            factoryHealthStatus=health_status,
            machineSummary={
                "total": machine_resp.totalMachines,
                "available": machine_resp.availableCount,
                "running": machine_resp.runningCount,
                "idle": machine_resp.idleCount,
                "maintenance": machine_resp.maintenanceCount,
                "breakdown": machine_resp.breakdownCount,
                "attentionRequired": machine_resp.attentionRequiredMachines,
            },
            machineUtilization=machine_resp.utilization,
            productionSummary={
                "totalOrdersCount": prod_resp.totalOrdersCount,
                "totalPlannedUnits": prod_resp.totalPlannedUnits,
                "totalProducedUnits": prod_resp.totalProducedUnits,
                "overallAchievementPct": prod_resp.overallAchievementPct,
                "activeOrdersCount": prod_resp.activeOrdersCount,
                "completedOrdersCount": prod_resp.completedOrdersCount,
            },
            delayedOrdersSummary={
                "delayedOrdersCount": prod_resp.delayedOrdersCount,
                "overdueOrderNumbers": [o.orderNumber for o in prod_resp.delayedOrders[:5]],
            },
            workforceSummary={
                "totalEmployees": workforce_resp.totalEmployees,
                "presentCount": workforce_resp.presentCount,
                "absentCount": workforce_resp.absentCount,
                "halfDayCount": workforce_resp.halfDayCount,
                "workforceAvailabilityPct": workforce_resp.workforceAvailabilityPct,
                "isWorkforceSufficient": workforce_resp.isWorkforceSufficient,
            },
            activeAlertsCount=len(alerts),
            criticalIssuesCount=critical_alerts_count,
            alerts=alerts,
            rootCauses=root_causes,
            recommendations=recommendations,
            missingDataNotice=" ".join(missing_notices),
        )

    def process_query(self, request: MonitoringQueryRequest) -> MonitoringQueryResponse:
        """
        Process natural language factory monitoring queries, gather factual metrics,
        and generate executive advisory answers.
        """
        date_str = request.targetDate or "2026-10-31"
        intent = self._classify_intent(request.query)

        # Retrieve factual metrics
        machine_resp = self.get_machine_status(date_str, request.runtimeHoursInput)
        prod_resp = self.get_production_status(date_str)
        workforce_resp = self.get_workforce_status(date_str)

        # Alerts
        alerts = self.alert_manager.generate_alerts(
            machine_resp=machine_resp,
            prod_resp=prod_resp,
            workforce_resp=workforce_resp,
            as_of_date=date_str,
        )

        # Recommendations
        rec_items = self.recommendation_engine.generate_recommendations(
            machine_resp=machine_resp,
            prod_resp=prod_resp,
            workforce_resp=workforce_resp,
        )
        rec_strings = [f"{r.actionText} (Priority: {r.priority.value})" for r in rec_items]

        # Missing data notices
        missing_notices: List[str] = []
        if not machine_resp.utilization.isCalculable:
            missing_notices.append(machine_resp.utilization.dataAvailabilityNote)

        # Overdue summary text
        overdue_lines = [
            f"  * {o.orderNumber} ({o.productName}): {o.remainingQuantity} units remaining, overdue by {o.delayDays} days (due {o.requiredDeliveryDate})"
            for o in prod_resp.delayedOrders[:4]
        ]
        overdue_summary = "\n".join(overdue_lines) if overdue_lines else "None"

        # Bottlenecks summary text
        bn_lines = [
            f"{b.get('stage')}: {b.get('constraintReason')}"
            for b in prod_resp.bottleneckStages
        ]
        bottleneck_summary = "; ".join(bn_lines) if bn_lines else "None"

        # Absent staff summary (privacy protected)
        absent_lines = [
            f"{e.employeeName} ({e.jobRole}) - Status: {e.attendanceStatus}"
            for e in workforce_resp.absentEmployees
        ]
        absent_staff_summary = "; ".join(absent_lines) if absent_lines else "None"

        # Alerts summary text
        alert_lines = [
            f"  * [{a.severity.value}] {a.alertId}: {a.description}"
            for a in alerts[:5]
        ]
        alerts_summary = "\n".join(alert_lines) if alert_lines else "No active alerts."

        # Recommendations summary text
        recs_summary = "\n".join([f"  * [{r.priority.value}] {r.actionText}" for r in rec_items[:4]])

        # Context for explanation service
        context: Dict[str, Any] = {
            "query": request.query,
            "intent": intent,
            "asOfDate": date_str,
            "totalMachines": machine_resp.totalMachines,
            "availableMachines": machine_resp.availableCount,
            "runningMachines": machine_resp.runningCount,
            "idleMachines": machine_resp.idleCount,
            "maintenanceMachines": machine_resp.maintenanceCount,
            "breakdownMachines": machine_resp.breakdownCount,
            "attentionMachines": machine_resp.attentionRequiredMachines,
            "utilizationPct": machine_resp.utilization.utilizationPct,
            "utilizationNote": machine_resp.utilization.dataAvailabilityNote,
            "totalPlannedUnits": prod_resp.totalPlannedUnits,
            "totalProducedUnits": prod_resp.totalProducedUnits,
            "overallAchievementPct": prod_resp.overallAchievementPct,
            "activeOrdersCount": prod_resp.activeOrdersCount,
            "delayedOrdersCount": prod_resp.delayedOrdersCount,
            "overdueSummary": overdue_summary,
            "bottleneckSummary": bottleneck_summary,
            "attendanceDate": workforce_resp.asOfDate,
            "totalEmployees": workforce_resp.totalEmployees,
            "presentEmployees": workforce_resp.presentCount,
            "absentEmployees": workforce_resp.absentCount,
            "halfDayEmployees": workforce_resp.halfDayCount,
            "workforceAvailabilityPct": workforce_resp.workforceAvailabilityPct,
            "absentStaffSummary": absent_staff_summary,
            "workforceSufficiencyNote": workforce_resp.workforceNotes,
            "activeAlertsCount": len(alerts),
            "alertsSummary": alerts_summary,
            "recommendationsSummary": recs_summary,
        }

        # Generate response text
        answer_text = self.explanation_service.generate_response(context)

        # Structured data payload tailored to intent
        structured_data: Dict[str, Any] = {
            "machines": machine_resp.model_dump(),
            "production": prod_resp.model_dump(),
            "workforce": workforce_resp.model_dump(),
        }

        return MonitoringQueryResponse(
            success=True,
            agent="monitoring_agent",
            tenantId=request.tenantId,
            asOfDate=date_str,
            query=request.query,
            intent=intent,
            answer=answer_text,
            structuredData=structured_data,
            alerts=alerts if request.includeAlerts else [],
            recommendations=rec_strings if request.includeRecommendations else [],
            missingDataNotices=missing_notices,
        )

    def _classify_intent(self, query: str) -> str:
        """Deterministic keyword-based query intent classifier."""
        q = query.lower()

        if "utiliz" in q:
            return "MACHINE_UTILIZATION"
        if any(w in q for w in ("delay", "overdue", "late order", "delivery schedule", "late delivery")):
            return "DELAYED_ORDERS"
        if any(w in q for w in ("machine", "equipment", "breakdown", "maintenance", "idle", "st-02", "fin-03")):
            return "MACHINE_STATUS"
        if any(w in q for w in ("attendance", "absent", "worker", "employee", "staff", "half day", "workforce")):
            return "WORKFORCE_STATUS"
        if any(w in q for w in ("alert", "warning", "critical issue")):
            return "ALERTS"
        if any(w in q for w in ("production", "produced", "planned", "target", "achievement", "order", "bottleneck")):
            return "PRODUCTION_STATUS"
        if any(w in q for w in ("health", "status", "summary", "overview", "report", "factory")):
            return "FACTORY_HEALTH"

        return "GENERAL"


# Global singleton instance
_monitoring_agent_instance: Optional[MonitoringAgent] = None


def get_monitoring_agent() -> MonitoringAgent:
    """Return the global MonitoringAgent instance."""
    global _monitoring_agent_instance
    if _monitoring_agent_instance is None:
        _monitoring_agent_instance = MonitoringAgent()
    return _monitoring_agent_instance
