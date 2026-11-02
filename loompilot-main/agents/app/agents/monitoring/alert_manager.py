from datetime import datetime, timezone
from typing import Dict, List, Optional

from app.core.logging import get_logger
from app.schemas.monitoring_schema import (
    AlertCategory,
    AlertSeverity,
    AlertStatus,
    MachineMonitoringResponse,
    OperationalAlert,
    ProductionMonitoringResponse,
    WorkforceMonitoringResponse,
)

logger = get_logger(__name__)


class OperationalAlertManager:
    """
    Deterministic operational alert manager for factory operations.
    Monitors machine health, production delays, bottleneck stages, and workforce availability.
    Enforces strict deduplication to ensure identical active operational events do not spawn
    duplicate active alerts.
    """

    def __init__(self):
        # Maps deduplication key -> active OperationalAlert
        self._active_alerts: Dict[str, OperationalAlert] = {}
        self._alert_counter: int = 1000

    def generate_alerts(
        self,
        machine_resp: MachineMonitoringResponse,
        prod_resp: ProductionMonitoringResponse,
        workforce_resp: WorkforceMonitoringResponse,
        as_of_date: Optional[str] = None,
    ) -> List[OperationalAlert]:
        """
        Evaluate factory metrics and generate deduplicated operational alerts.
        If an alert for an unresolved event already exists, it is preserved without duplicating.
        """
        target_date = as_of_date or machine_resp.asOfDate or datetime.now(timezone.utc).strftime("%Y-%m-%d")
        now_ts = datetime.now(timezone.utc).isoformat()

        # -------------------------------------------------------------
        # 1. Machine Health Alerts
        # -------------------------------------------------------------
        for m in machine_resp.machines:
            if m.isUnderMaintenance:
                dedup_key = f"MACHINE:{m.machineCode}:MAINTENANCE"
                if dedup_key not in self._active_alerts:
                    alert_id = f"ALT-MCH-{m.machineCode}"
                    self._active_alerts[dedup_key] = OperationalAlert(
                        alertId=alert_id,
                        category=AlertCategory.MACHINE,
                        severity=AlertSeverity.HIGH,
                        relatedEntity=m.machineCode,
                        description=f"Machine {m.machineCode} ({m.machineType}) is currently offline under maintenance in {m.processArea}.",
                        evidence=(
                            f"Verified record from LoomPilot_Machines.xlsx: MachineID={m.machineId}, "
                            f"MachineCode='{m.machineCode}', CurrentStatus='{m.currentStatus}', ProcessArea='{m.processArea}'."
                        ),
                        detectedTimestamp=now_ts,
                        recommendedAction=(
                            f"Inspect maintenance log for {m.machineCode}, verify technician progress in {m.processArea}, "
                            "and estimate return-to-service time to minimize production scheduling drag."
                        ),
                        status=AlertStatus.ACTIVE,
                    )
            elif m.currentStatus.lower() in ("breakdown", "failed", "out of order"):
                dedup_key = f"MACHINE:{m.machineCode}:BREAKDOWN"
                if dedup_key not in self._active_alerts:
                    alert_id = f"ALT-BRK-{m.machineCode}"
                    self._active_alerts[dedup_key] = OperationalAlert(
                        alertId=alert_id,
                        category=AlertCategory.MACHINE,
                        severity=AlertSeverity.CRITICAL,
                        relatedEntity=m.machineCode,
                        description=f"Mechanical breakdown detected on {m.machineCode} in {m.processArea}.",
                        evidence=(
                            f"Verified record from LoomPilot_Machines.xlsx: MachineID={m.machineId}, "
                            f"MachineCode='{m.machineCode}', CurrentStatus='{m.currentStatus}'."
                        ),
                        detectedTimestamp=now_ts,
                        recommendedAction=f"Immediately dispatch senior repair engineer to restore {m.machineCode}.",
                        status=AlertStatus.ACTIVE,
                    )

        # -------------------------------------------------------------
        # 2. Production Delay Alerts
        # -------------------------------------------------------------
        for o in prod_resp.delayedOrders:
            dedup_key = f"PRODUCTION:{o.orderNumber}:DELAY"
            if dedup_key not in self._active_alerts:
                severity = AlertSeverity.CRITICAL if o.delayDays > 14 else AlertSeverity.HIGH
                alert_id = f"ALT-ORD-{o.orderNumber}"
                self._active_alerts[dedup_key] = OperationalAlert(
                    alertId=alert_id,
                    category=AlertCategory.PRODUCTION,
                    severity=severity,
                    relatedEntity=o.orderNumber,
                    description=(
                        f"Order {o.orderNumber} ({o.productName}) is overdue by {o.delayDays} day(s). "
                        f"Target delivery was {o.requiredDeliveryDate} with {o.remainingQuantity} units remaining."
                    ),
                    evidence=(
                        f"Verified record from LoomPilot_Orders.xlsx: OrderID={o.orderId}, "
                        f"OrderNumber='{o.orderNumber}', RequiredDeliveryDate='{o.requiredDeliveryDate}', "
                        f"OrderQuantity={o.orderQuantity}, ProducedQuantity={o.producedQuantity}, "
                        f"RemainingQuantity={o.remainingQuantity}, EvaluatedAsOf='{target_date}'."
                    ),
                    detectedTimestamp=now_ts,
                    recommendedAction=(
                        f"Prioritize production scheduling for {o.orderNumber} across operational lines; "
                        "notify customer relationship team of revised delivery timeline."
                    ),
                    status=AlertStatus.ACTIVE,
                )

        # -------------------------------------------------------------
        # 3. Stage Bottleneck Alerts
        # -------------------------------------------------------------
        for b in prod_resp.bottleneckStages:
            stage_name = b.get("stage", "General")
            dedup_key = f"PRODUCTION:STAGE:{stage_name.upper()}"
            if dedup_key not in self._active_alerts:
                alert_id = f"ALT-STG-{stage_name.upper()}"
                sev = AlertSeverity.HIGH if b.get("severity") == "HIGH" else AlertSeverity.MEDIUM
                self._active_alerts[dedup_key] = OperationalAlert(
                    alertId=alert_id,
                    category=AlertCategory.PRODUCTION,
                    severity=sev,
                    relatedEntity=stage_name,
                    description=f"Process constraint identified in {stage_name} stage: {b.get('constraintReason', '')}",
                    evidence=(
                        f"Production reports summary: Produced={b.get('producedUnits', 0)}, "
                        f"Defects={b.get('defectiveUnits', 0)} ({b.get('defectRatePct', 0)}%). "
                        f"Constraint note: {b.get('constraintReason', '')}."
                    ),
                    detectedTimestamp=now_ts,
                    recommendedAction=(
                        f"Rebalance line flow in {stage_name}. If caused by offline equipment, "
                        "reroute work in progress to parallel operational machines."
                    ),
                    status=AlertStatus.ACTIVE,
                )

        # -------------------------------------------------------------
        # 4. Workforce Attendance Alerts
        # -------------------------------------------------------------
        if workforce_resp.totalEmployees > 0:
            if workforce_resp.workforceAvailabilityPct < 90.0 or workforce_resp.absentCount > 2:
                dedup_key = f"WORKFORCE:ATTENDANCE:{workforce_resp.asOfDate}"
                if dedup_key not in self._active_alerts:
                    alert_id = f"ALT-WF-{workforce_resp.asOfDate.replace('-', '')}"
                    sev = (
                        AlertSeverity.HIGH
                        if workforce_resp.workforceAvailabilityPct < 80.0
                        else AlertSeverity.MEDIUM
                    )
                    self._active_alerts[dedup_key] = OperationalAlert(
                        alertId=alert_id,
                        category=AlertCategory.WORKFORCE,
                        severity=sev,
                        relatedEntity="Factory Workforce",
                        description=(
                            f"Elevated workforce absenteeism detected on {workforce_resp.asOfDate}: "
                            f"{workforce_resp.absentCount} absent/leave out of {workforce_resp.totalEmployees} employees "
                            f"(Workforce Availability: {workforce_resp.workforceAvailabilityPct:.1f}%)."
                        ),
                        evidence=(
                            f"Verified record from LoomPilot_Attendance.xlsx: Date={workforce_resp.asOfDate}, "
                            f"Total={workforce_resp.totalEmployees}, Present={workforce_resp.presentCount}, "
                            f"Absent={workforce_resp.absentCount}, HalfDay={workforce_resp.halfDayCount}, Leave={workforce_resp.leaveCount}."
                        ),
                        detectedTimestamp=now_ts,
                        recommendedAction=(
                            "Mobilize cross-skilled operators to cover critical cutting and stitching workstations; "
                            "monitor shift throughput to avoid compounding order delays."
                        ),
                        status=AlertStatus.ACTIVE,
                    )

        # Return list of active alerts, sorted by severity (CRITICAL first, then HIGH, then MEDIUM, LOW)
        severity_order = {
            AlertSeverity.CRITICAL: 0,
            AlertSeverity.HIGH: 1,
            AlertSeverity.MEDIUM: 2,
            AlertSeverity.LOW: 3,
        }
        active_list = list(self._active_alerts.values())
        return sorted(active_list, key=lambda a: severity_order.get(a.severity, 99))

    def get_active_alerts(self) -> List[OperationalAlert]:
        """Return currently active alerts."""
        return list(self._active_alerts.values())

    def acknowledge_alert(self, alert_id: str) -> bool:
        """Mark an active alert as acknowledged."""
        for key, alert in self._active_alerts.items():
            if alert.alertId == alert_id:
                alert.status = AlertStatus.ACKNOWLEDGED
                return True
        return False

    def resolve_alert(self, alert_id: str) -> bool:
        """Resolve and archive an alert."""
        for key, alert in list(self._active_alerts.items()):
            if alert.alertId == alert_id:
                alert.status = AlertStatus.RESOLVED
                del self._active_alerts[key]
                return True
        return False

    def clear(self) -> None:
        """Reset internal alert registry."""
        self._active_alerts.clear()
