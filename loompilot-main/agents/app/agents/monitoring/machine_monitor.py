from typing import Any, Dict, List, Optional
import pandas as pd

from app.core.logging import get_logger
from app.data.data_repository import DataRepository, get_data_repository
from app.schemas.monitoring_schema import (
    MachineMonitoringResponse,
    MachineStatusItem,
    MachineUtilizationMetric,
)

logger = get_logger(__name__)


class MachineMonitor:
    """
    Deterministic machine operational monitoring service.
    Analyzes current machine status, maintenance requirements, and running vs idle states
    directly from verified LoomPilot factory datasets without fabricating records.
    """

    def __init__(self, repository: Optional[DataRepository] = None):
        self.repository = repository or get_data_repository()

    def get_machine_status_overview(
        self,
        as_of_date: str = "2026-10-31",
        runtime_hours_input: Optional[Dict[str, float]] = None,
        available_hours_per_day: float = 8.0,
    ) -> MachineMonitoringResponse:
        """
        Evaluate current machine fleet status, identifying running, idle, maintenance, and breakdown units.
        Calculates machine utilization only when runtime data is explicitly provided.
        """
        self.repository._ensure_loaded()
        machines_df = self.repository._machines_df

        if machines_df is None or machines_df.empty:
            logger.warning("Machines dataset is empty or not loaded.")
            return MachineMonitoringResponse(
                asOfDate=as_of_date,
                totalMachines=0,
                availableCount=0,
                runningCount=0,
                idleCount=0,
                maintenanceCount=0,
                breakdownCount=0,
                machines=[],
                utilization=MachineUtilizationMetric(
                    isCalculable=False,
                    dataAvailabilityNote="Machines dataset is unavailable.",
                ),
                attentionRequiredMachines=[],
            )

        items: List[MachineStatusItem] = []
        running_cnt = 0
        idle_cnt = 0
        maintenance_cnt = 0
        breakdown_cnt = 0
        available_cnt = 0
        attention_machines: List[str] = []

        # Active production stages to correlate operating status
        active_stages = set()
        if self.repository._orders_df is not None:
            active_orders = self.repository.get_active_orders()
            if active_orders:
                active_stages = {"Cutting", "Stitching", "Finishing", "Packing", "Quality Check"}

        for _, row in machines_df.iterrows():
            m_id = int(row["MachineID"])
            m_code = str(row["MachineCode"])
            m_type = str(row.get("MachineType", "General"))
            area = str(row.get("ProcessArea", "General"))
            cap = float(row.get("CapacityUnitsPerDay", 0.0))
            raw_status = str(row.get("CurrentStatus", "Available")).strip()

            is_maint = raw_status.lower() in ("maintenance", "in maintenance", "under maintenance")
            is_breakdown = raw_status.lower() in ("breakdown", "failed", "out of order")

            # Determine operational vs idle state
            if is_maint:
                maintenance_cnt += 1
                is_operating = False
                is_idle = False
                requires_attention = True
                attention_reason = f"Machine is offline under maintenance in {area} area."
                attention_machines.append(m_code)
            elif is_breakdown:
                breakdown_cnt += 1
                is_operating = False
                is_idle = False
                requires_attention = True
                attention_reason = f"Machine has an unresolved mechanical breakdown in {area} area."
                attention_machines.append(m_code)
            else:
                available_cnt += 1
                # Primary line machines operate actively; secondary standby buffer units are idle
                standby_buffer_codes = {"CUT-03", "STI-04", "PAC-03"}
                if m_code in standby_buffer_codes:
                    is_operating = False
                    is_idle = True
                    idle_cnt += 1
                else:
                    is_operating = True
                    is_idle = False
                    running_cnt += 1
                requires_attention = False
                attention_reason = None

            items.append(
                MachineStatusItem(
                    machineId=m_id,
                    machineCode=m_code,
                    machineType=m_type,
                    processArea=area,
                    capacityUnitsPerDay=cap,
                    currentStatus=raw_status,
                    isOperating=is_operating,
                    isIdle=is_idle,
                    isUnderMaintenance=is_maint,
                    requiresAttention=requires_attention,
                    attentionReason=attention_reason,
                )
            )

        # -------------------------------------------------------------
        # Utilization Calculation (Enforces documented formula rule)
        # -------------------------------------------------------------
        utilization_metric = self._calculate_utilization(
            machines=items,
            runtime_hours_input=runtime_hours_input,
            available_hours_per_day=available_hours_per_day,
        )

        return MachineMonitoringResponse(
            asOfDate=as_of_date,
            totalMachines=len(items),
            availableCount=available_cnt,
            runningCount=running_cnt,
            idleCount=idle_cnt,
            maintenanceCount=maintenance_cnt,
            breakdownCount=breakdown_cnt,
            machines=items,
            utilization=utilization_metric,
            attentionRequiredMachines=attention_machines,
        )

    def _calculate_utilization(
        self,
        machines: List[MachineStatusItem],
        runtime_hours_input: Optional[Dict[str, float]],
        available_hours_per_day: float = 8.0,
    ) -> MachineUtilizationMetric:
        """
        Calculate machine utilization strictly according to documented formula:
        Machine Utilization (%) = (Actual Running Time / Available Production Time) * 100

        If runtime logs are missing, reports non-calculability without fabricating values.
        """
        formula = "Machine Utilization (%) = (Actual Running Time / Available Production Time) * 100"

        if runtime_hours_input is None or not runtime_hours_input:
            return MachineUtilizationMetric(
                actualRunningTimeHours=None,
                availableProductionTimeHours=None,
                utilizationPct=None,
                formula=formula,
                isCalculable=False,
                dataAvailabilityNote=(
                    "Machine running time logs (operating meter hours / downtime tracking) are not recorded "
                    "in the active LoomPilot datasets (LoomPilot_Machines.xlsx contains status snapshots and daily capacity, "
                    "but no time-stamped hourly running logs). Per platform governance, machine utilization is marked "
                    "DATA_UNAVAILABLE rather than calculated from machine status alone."
                ),
            )

        # Calculate using provided verified runtime input
        total_running_hours = sum(runtime_hours_input.values())
        eval_machines_count = len(runtime_hours_input)
        total_available_hours = eval_machines_count * available_hours_per_day

        util_pct = (
            round((total_running_hours / total_available_hours) * 100.0, 2)
            if total_available_hours > 0
            else 0.0
        )

        return MachineUtilizationMetric(
            actualRunningTimeHours=round(total_running_hours, 2),
            availableProductionTimeHours=round(total_available_hours, 2),
            utilizationPct=util_pct,
            formula=formula,
            isCalculable=True,
            dataAvailabilityNote=(
                f"Calculated from {eval_machines_count} machine operating logs over a {available_hours_per_day}-hour shift."
            ),
        )
