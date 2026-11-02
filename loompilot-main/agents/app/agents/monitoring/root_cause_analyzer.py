from typing import List, Optional

from app.schemas.monitoring_schema import (
    MachineMonitoringResponse,
    ProductionMonitoringResponse,
    RootCauseItem,
    WorkforceMonitoringResponse,
)


class RootCauseAnalyzer:
    """
    Deterministic root-cause analyzer for factory operational discrepancies.
    Separates verified empirical facts (direct dataset records) from possible operational
    correlations (inferred patterns) so operations managers have clear diagnostic clarity.
    """

    def analyze_causes(
        self,
        machine_resp: MachineMonitoringResponse,
        prod_resp: ProductionMonitoringResponse,
        workforce_resp: WorkforceMonitoringResponse,
    ) -> List[RootCauseItem]:
        """
        Evaluate anomalies across machines, orders, and workforce to diagnose verified and probable root causes.
        """
        root_causes: List[RootCauseItem] = []

        # -------------------------------------------------------------
        # 1. Machine Maintenance & Breakdown Causes
        # -------------------------------------------------------------
        for m in machine_resp.machines:
            if m.isUnderMaintenance:
                # Verified Cause
                root_causes.append(
                    RootCauseItem(
                        issueType="CAPACITY_REDUCTION",
                        relatedEntity=m.machineCode,
                        isVerified=True,
                        causeDescription=(
                            f"Machine {m.machineCode} ({m.machineType}) in {m.processArea} is officially offline "
                            "under scheduled/unscheduled maintenance."
                        ),
                        supportingEvidence=(
                            f"LoomPilot_Machines dataset: MachineID={m.machineId}, Status='{m.currentStatus}', "
                            f"DailyCapacity={m.capacityUnitsPerDay} units."
                        ),
                    )
                )
                # Correlated / Possible Cause
                root_causes.append(
                    RootCauseItem(
                        issueType="SCHEDULE_DRAG",
                        relatedEntity=m.machineCode,
                        isVerified=False,
                        causeDescription=(
                            f"Downtime on {m.machineCode} likely creates throughput deficits in the {m.processArea} stage, "
                            "contributing to backlogs in active manufacturing orders."
                        ),
                        supportingEvidence=(
                            f"{m.processArea} operates at reduced fleet capacity while {m.machineCode} is unavailable."
                        ),
                    )
                )

        # -------------------------------------------------------------
        # 2. Production Schedule Delays Causes
        # -------------------------------------------------------------
        if prod_resp.delayedOrdersCount > 0:
            top_delayed = prod_resp.delayedOrders[:3]
            for order in top_delayed:
                # Verified Cause
                root_causes.append(
                    RootCauseItem(
                        issueType="DELIVERY_OVERDUE",
                        relatedEntity=order.orderNumber,
                        isVerified=True,
                        causeDescription=(
                            f"Order {order.orderNumber} ({order.productName}) has exceeded required delivery date "
                            f"({order.requiredDeliveryDate}) by {order.delayDays} day(s) with {order.remainingQuantity} units remaining."
                        ),
                        supportingEvidence=(
                            f"LoomPilot_Orders dataset: RequiredDeliveryDate='{order.requiredDeliveryDate}', "
                            f"ProducedQuantity={order.producedQuantity}/{order.orderQuantity} ({order.productionAchievementPct}%)."
                        ),
                    )
                )
                # Possible Cause
                root_causes.append(
                    RootCauseItem(
                        issueType="BOTTLENECK_IMPACT",
                        relatedEntity=order.orderNumber,
                        isVerified=False,
                        causeDescription=(
                            f"Delay on {order.orderNumber} may be amplified by equipment downtime in key process stages "
                            "(e.g., stitching or finishing maintenance) and batch queuing."
                        ),
                        supportingEvidence=(
                            f"Order progress is at {order.productionAchievementPct}% completion with {order.remainingQuantity} units pending."
                        ),
                    )
                )

        # -------------------------------------------------------------
        # 3. Workforce Causes
        # -------------------------------------------------------------
        if workforce_resp.absentCount > 0:
            if workforce_resp.workforceAvailabilityPct < 90.0 or workforce_resp.absentCount > 2:
                # Verified Cause
                absent_names = [e.employeeName for e in workforce_resp.absentEmployees[:3]]
                root_causes.append(
                    RootCauseItem(
                        issueType="WORKFORCE_DEFICIT",
                        relatedEntity="Factory Floor",
                        isVerified=True,
                        causeDescription=(
                            f"{workforce_resp.absentCount} employee(s) are absent or on leave on {workforce_resp.asOfDate}, "
                            f"resulting in a workforce availability of {workforce_resp.workforceAvailabilityPct:.1f}%."
                        ),
                        supportingEvidence=(
                            f"LoomPilot_Attendance dataset on {workforce_resp.asOfDate}: Present={workforce_resp.presentCount}, "
                            f"Absent={workforce_resp.absentCount}, HalfDay={workforce_resp.halfDayCount}. Absent examples: {', '.join(absent_names)}."
                        ),
                    )
                )
                # Possible Cause
                root_causes.append(
                    RootCauseItem(
                        issueType="PRODUCTIVITY_IMPACT",
                        relatedEntity="Production Output",
                        isVerified=False,
                        causeDescription=(
                            "Workforce absenteeism across operational roles may lead to idle workstations and reduced shift piece-rate output."
                        ),
                        supportingEvidence=(
                            f"Effective attendance is {workforce_resp.presentCount + 0.5 * workforce_resp.halfDayCount} "
                            f"against scheduled total of {workforce_resp.totalEmployees} staff."
                        ),
                    )
                )

        return root_causes

