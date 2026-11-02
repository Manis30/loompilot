from datetime import datetime
from typing import Any, Dict, List, Optional
import pandas as pd

from app.core.logging import get_logger
from app.data.data_repository import DataRepository, get_data_repository
from app.schemas.monitoring_schema import (
    ProductionMonitoringResponse,
    ProductionOrderItem,
)

logger = get_logger(__name__)


class ProductionMonitor:
    """
    Deterministic factory production monitoring service.
    Analyzes planned vs actual production output, identifies schedule delays,
    and isolates stage bottlenecks using verified order and production report records.
    """

    def __init__(self, repository: Optional[DataRepository] = None):
        self.repository = repository or get_data_repository()

    def get_production_overview(
        self,
        as_of_date: str = "2026-10-31",
    ) -> ProductionMonitoringResponse:
        """
        Analyze current production progress, calculate achievement %,
        and identify all overdue manufacturing orders.
        """
        self.repository._ensure_loaded()
        orders_df = self.repository._orders_df
        reports_df = self.repository._production_reports_df
        cutoff_dt = pd.to_datetime(as_of_date)

        if orders_df is None or orders_df.empty:
            logger.warning("Orders dataset is empty or not loaded.")
            return ProductionMonitoringResponse(
                asOfDate=as_of_date,
                totalPlannedUnits=0,
                totalProducedUnits=0,
                overallAchievementPct=0.0,
                totalOrdersCount=0,
                activeOrdersCount=0,
                completedOrdersCount=0,
                delayedOrdersCount=0,
                delayedOrders=[],
                activeOrders=[],
                bottleneckStages=[],
            )

        active_items: List[ProductionOrderItem] = []
        delayed_items: List[ProductionOrderItem] = []
        total_planned = 0
        total_produced = 0
        completed_cnt = 0
        active_cnt = 0

        # Build stage progress index from production reports
        stage_progress_by_order: Dict[int, List[Dict[str, Any]]] = {}
        if reports_df is not None and not reports_df.empty:
            for _, r in reports_df.iterrows():
                o_id = int(r["OrderID"])
                if o_id not in stage_progress_by_order:
                    stage_progress_by_order[o_id] = []
                stage_progress_by_order[o_id].append({
                    "stage": str(r["ProcessStage"]),
                    "produced": int(r["CumulativeProducedQuantity"]),
                    "defects": int(r["DefectiveQuantity"]),
                    "reportDate": str(r["ReportDate"])[:10],
                    "notes": str(r.get("IssueNotes", "")),
                })

        for _, row in orders_df.iterrows():
            o_id = int(row["OrderID"])
            o_num = str(row["OrderNumber"])
            prod_id = int(row.get("ProductID", 1))
            prod_info = self.repository.get_product(prod_id)
            prod_name = prod_info["ProductName"] if prod_info else f"Product #{prod_id}"

            planned_qty = int(row.get("OrderQuantity", 0))
            produced_qty = int(row.get("ProducedQuantity", 0))
            remaining_qty = int(row.get("RemainingQuantity", 0))
            status_str = str(row.get("OrderStatus", "Completed")).strip()

            total_planned += planned_qty
            total_produced += produced_qty

            achieve_pct = (
                round((produced_qty / planned_qty) * 100.0, 2)
                if planned_qty > 0
                else 0.0
            )

            req_date_str = str(row.get("RequiredDeliveryDate", ""))[:10]
            rec_date_str = str(row.get("ReceivedDate", ""))[:10]
            req_dt = pd.to_datetime(req_date_str) if req_date_str else None

            # Delay evaluation: Not completed, remaining units > 0, and required date on or before cutoff
            is_delayed = False
            delay_days = 0
            if status_str.lower() != "completed" and remaining_qty > 0 and req_dt is not None:
                if req_dt <= cutoff_dt:
                    is_delayed = True
                    delay_days = max(0, (cutoff_dt - req_dt).days)

            order_item = ProductionOrderItem(
                orderId=o_id,
                orderNumber=o_num,
                productId=prod_id,
                productName=prod_name,
                orderQuantity=planned_qty,
                producedQuantity=produced_qty,
                remainingQuantity=remaining_qty,
                productionAchievementPct=achieve_pct,
                receivedDate=rec_date_str,
                requiredDeliveryDate=req_date_str,
                isDelayed=is_delayed,
                delayDays=delay_days,
                orderStatus=status_str,
                stagesProgress=stage_progress_by_order.get(o_id, []),
            )

            if status_str.lower() == "completed":
                completed_cnt += 1
            else:
                active_cnt += 1
                active_items.append(order_item)
                if is_delayed:
                    delayed_items.append(order_item)

        overall_achievement = (
            round((total_produced / total_planned) * 100.0, 2)
            if total_planned > 0
            else 0.0
        )

        # Identify bottleneck stages
        bottlenecks = self._identify_stage_bottlenecks(reports_df)

        return ProductionMonitoringResponse(
            asOfDate=as_of_date,
            totalPlannedUnits=total_planned,
            totalProducedUnits=total_produced,
            overallAchievementPct=overall_achievement,
            totalOrdersCount=len(orders_df),
            activeOrdersCount=active_cnt,
            completedOrdersCount=completed_cnt,
            delayedOrdersCount=len(delayed_items),
            delayedOrders=sorted(delayed_items, key=lambda x: x.delayDays, reverse=True),
            activeOrders=active_items,
            bottleneckStages=bottlenecks,
        )

    def _identify_stage_bottlenecks(
        self,
        reports_df: Optional[pd.DataFrame],
    ) -> List[Dict[str, Any]]:
        """
        Identify stages experiencing production drag, machine bottlenecks, or elevated defects.
        """
        if reports_df is None or reports_df.empty:
            return []

        bottlenecks = []
        stage_summary = reports_df.groupby("ProcessStage").agg({
            "CumulativeProducedQuantity": "sum",
            "DefectiveQuantity": "sum",
        }).reset_index()

        total_defects = stage_summary["DefectiveQuantity"].sum()

        for _, r in stage_summary.iterrows():
            stage = str(r["ProcessStage"])
            prod = float(r["CumulativeProducedQuantity"])
            defects = float(r["DefectiveQuantity"])
            defect_rate = round((defects / prod) * 100.0, 2) if prod > 0 else 0.0

            # Correlate with machine maintenance in this stage
            is_machine_constrained = False
            constraint_notes = []
            if self.repository._machines_df is not None:
                maint_machines = self.repository._machines_df[
                    (self.repository._machines_df["ProcessArea"].str.lower() == stage.lower()) &
                    (self.repository._machines_df["CurrentStatus"].str.lower() == "maintenance")
                ]
                if not maint_machines.empty:
                    is_machine_constrained = True
                    codes = ", ".join(maint_machines["MachineCode"].tolist())
                    constraint_notes.append(f"Offline machine(s) in maintenance: {codes}")

            if is_machine_constrained or defect_rate >= 1.6:
                bottlenecks.append({
                    "stage": stage,
                    "producedUnits": int(prod),
                    "defectiveUnits": int(defects),
                    "defectRatePct": defect_rate,
                    "isConstrained": True,
                    "severity": "HIGH" if is_machine_constrained else "MEDIUM",
                    "constraintReason": "; ".join(constraint_notes) if constraint_notes else "Elevated quality defect rate.",
                })

        return bottlenecks
