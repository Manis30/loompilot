from typing import List

from app.schemas.monitoring_schema import (
    AlertCategory,
    AlertSeverity,
    MachineMonitoringResponse,
    ProductionMonitoringResponse,
    RecommendationItem,
    WorkforceMonitoringResponse,
)


class RecommendationEngine:
    """
    Actionable, data-grounded recommendation engine for textile factory management.
    Provides targeted operational guidance without fabricating data or performing unauthorized automated mutations.
    """

    def generate_recommendations(
        self,
        machine_resp: MachineMonitoringResponse,
        prod_resp: ProductionMonitoringResponse,
        workforce_resp: WorkforceMonitoringResponse,
    ) -> List[RecommendationItem]:
        """
        Generate prioritized operational recommendations based on current factory observations.
        """
        recs: List[RecommendationItem] = []
        counter = 1

        # -------------------------------------------------------------
        # 1. Maintenance Expediting Recommendations
        # -------------------------------------------------------------
        for m in machine_resp.machines:
            if m.isUnderMaintenance or m.currentStatus.lower() in ("maintenance", "breakdown"):
                recs.append(
                    RecommendationItem(
                        recommendationId=f"REC-{counter:03d}",
                        priority=AlertSeverity.HIGH,
                        category=AlertCategory.MACHINE,
                        targetEntity=m.machineCode,
                        actionText=(
                            f"Expedite maintenance workflow on machine {m.machineCode} in {m.processArea} "
                            "and verify technician spare part requirements."
                        ),
                        justification=(
                            f"{m.machineCode} is currently offline (status: {m.currentStatus}). "
                            f"Restoring it will return {m.capacityUnitsPerDay:.0f} units/day to active capacity."
                        ),
                        isAutomatedAction=False,
                    )
                )
                counter += 1

        # -------------------------------------------------------------
        # 2. Delayed Orders Expediting
        # -------------------------------------------------------------
        if prod_resp.delayedOrdersCount > 0:
            top_delayed = prod_resp.delayedOrders[:2]
            for order in top_delayed:
                recs.append(
                    RecommendationItem(
                        recommendationId=f"REC-{counter:03d}",
                        priority=AlertSeverity.CRITICAL if order.delayDays > 14 else AlertSeverity.HIGH,
                        category=AlertCategory.PRODUCTION,
                        targetEntity=order.orderNumber,
                        actionText=(
                            f"Fast-track manufacturing line priority for order {order.orderNumber} ({order.productName}) "
                            f"to clear the remaining {order.remainingQuantity} units."
                        ),
                        justification=(
                            f"Order delivery date ({order.requiredDeliveryDate}) has lapsed by {order.delayDays} day(s). "
                            f"Current production achievement is at {order.productionAchievementPct}%."
                        ),
                        isAutomatedAction=False,
                    )
                )
                counter += 1

        # -------------------------------------------------------------
        # 3. Workforce Line Balancing
        # -------------------------------------------------------------
        if workforce_resp.absentCount > 0:
            recs.append(
                RecommendationItem(
                    recommendationId=f"REC-{counter:03d}",
                    priority=AlertSeverity.MEDIUM,
                    category=AlertCategory.WORKFORCE,
                    targetEntity="Shift Supervisors",
                    actionText=(
                        "Deploy cross-trained operators to cover vacant workstations, prioritizing stitching and cutting lines."
                    ),
                    justification=(
                        f"Workforce availability is at {workforce_resp.workforceAvailabilityPct:.1f}% on {workforce_resp.asOfDate} "
                        f"with {workforce_resp.absentCount} employee(s) absent or on leave."
                    ),
                    isAutomatedAction=False,
                )
            )
            counter += 1

        # -------------------------------------------------------------
        # 4. Data Logging & Operational Telemetry Recommendation
        # -------------------------------------------------------------
        if not machine_resp.utilization.isCalculable:
            recs.append(
                RecommendationItem(
                    recommendationId=f"REC-{counter:03d}",
                    priority=AlertSeverity.LOW,
                    category=AlertCategory.GENERAL,
                    targetEntity="Plant Operations & IT",
                    actionText=(
                        "Implement shift-level machine operating hours logging (runtime meters) on factory floor terminals."
                    ),
                    justification=(
                        "Machine status and capacity are tracked, but time-stamped running vs downtime hour meters are "
                        "currently unrecorded. Daily runtime logging will enable automated Machine Utilization % calculations."
                    ),
                    isAutomatedAction=False,
                )
            )
            counter += 1

        return recs

