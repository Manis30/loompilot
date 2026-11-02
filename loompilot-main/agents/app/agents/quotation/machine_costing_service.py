from typing import Any, Dict, List, Optional

from app.core.logging import get_logger
from app.data.data_repository import DataRepository
from app.schemas.quotation_schema import (
    CostComponentStatus,
    MachineCostBreakdown,
    MachineCostItem,
)

logger = get_logger(__name__)


class MachineCostingService:
    """
    Calculates machine operating costs (energy, power, lubrication, maintenance, and machine depreciation)
    across production stages without mutating floor reservation states.
    """

    # Stage-level representative machine throughput in units per hour (8-hour shift basis)
    STAGE_MACHINE_THROUGHPUT: Dict[str, float] = {
        "Cutting": 53.12,   # ~425 units/8h
        "Stitching": 22.50,  # ~180 units/8h
        "Finishing": 37.50,  # ~300 units/8h
        "Packing": 62.50,    # ~500 units/8h
    }

    # Representative machine types mapped to process areas
    STAGE_MACHINE_TYPES: Dict[str, str] = {
        "Cutting": "Fabric Cutting Machine (CUT-01/02)",
        "Stitching": "Industrial Sewing Machine (ST-01/03)",
        "Finishing": "Industrial Steam Press & QC (FIN-01)",
        "Packing": "Packing Workstation (PK-01/PAC-03)",
    }

    # Baseline operating cost per machine hour (electricity, steam, maintenance, depreciation)
    FACTORY_BASELINE_MACHINE_RATES: Dict[str, float] = {
        "Cutting": 85.0,    # High power electric motor, blade maintenance
        "Stitching": 65.0,  # Single-phase/3-phase sewing motor, lubrication
        "Finishing": 95.0,  # Steam boiler heating, electric iron
        "Packing": 40.0,    # Workstation auxiliary power
    }

    def __init__(self, repository: DataRepository):
        self.repository = repository

    def calculate_machine_costs(
        self,
        stages: List[str],
        order_quantity: int,
        machine_rate_overrides: Optional[Dict[str, Optional[float]]] = None,
    ) -> MachineCostBreakdown:
        """
        Calculate machine operating expenses for all stages in product routing.
        If machine operating rates are missing or undefined, flags incomplete costing.
        """
        if not stages:
            stages = ["Cutting", "Stitching", "Finishing", "Packing"]

        items: List[MachineCostItem] = []
        missing_machines: List[str] = []
        has_incomplete = False
        total_machine_cost = 0.0
        total_machine_hours = 0.0

        for stage in stages:
            stage_name = stage.strip()
            throughput = self.STAGE_MACHINE_THROUGHPUT.get(stage_name, 30.0)
            machine_type = self.STAGE_MACHINE_TYPES.get(stage_name, f"{stage_name} Equipment")

            operating_hours = round(order_quantity / max(1.0, throughput), 2)
            total_machine_hours += operating_hours

            rate: Optional[float] = None
            status = "VALID"
            missing_reason = None

            if machine_rate_overrides is not None:
                if stage_name in machine_rate_overrides:
                    rate = machine_rate_overrides[stage_name]
                    if rate is not None:
                        rate = float(rate)
                    else:
                        status = "UNAVAILABLE"
                        missing_reason = f"Machine rate for stage '{stage_name}' explicitly set to None"
                else:
                    status = "UNAVAILABLE"
                    missing_reason = f"Hourly machine operating rate missing for stage '{stage_name}'"
            else:
                rate = self.FACTORY_BASELINE_MACHINE_RATES.get(stage_name)
                if rate is None:
                    status = "UNAVAILABLE"
                    missing_reason = f"Baseline operating rate not configured for machine type '{machine_type}'"

            line_cost: Optional[float] = None
            if rate is not None and status == "VALID":
                line_cost = round(operating_hours * rate, 2)
                total_machine_cost += line_cost
            else:
                has_incomplete = True
                missing_machines.append(stage_name)

            items.append(
                MachineCostItem(
                    stage=stage_name,
                    machineType=machine_type,
                    standardThroughputUnitsPerHour=throughput,
                    machineOperatingHours=operating_hours,
                    hourlyOperatingCostINR=rate,
                    totalCost=line_cost,
                    currency="INR",
                    powerAndMaintenanceAllocation=round(line_cost * 0.4, 2) if line_cost else None,
                    status=status,
                    missingReason=missing_reason,
                )
            )

        status_enum = CostComponentStatus.INCOMPLETE if has_incomplete else CostComponentStatus.COMPLETE
        final_total = round(total_machine_cost, 2) if not has_incomplete else None

        return MachineCostBreakdown(
            status=status_enum,
            operations=items,
            totalCost=final_total,
            totalMachineHours=round(total_machine_hours, 2),
            missingMachines=missing_machines,
        )

