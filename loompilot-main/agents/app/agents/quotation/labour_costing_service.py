from typing import Any, Dict, List, Optional

from app.core.logging import get_logger
from app.data.data_repository import DataRepository
from app.schemas.quotation_schema import (
    CostComponentStatus,
    LabourCostBreakdown,
    LabourCostItem,
)

logger = get_logger(__name__)


class LabourCostingService:
    """
    Calculates direct manufacturing labour costs per production stage.
    Derived from standard operation time studies and departmental hourly rates.
    """

    # Standard cycle times in hours per finished unit (calibrated from machine throughput)
    # Cutting: ~425 units/8h = 0.0188 h/unit
    # Stitching: ~180 units/8h = 0.0444 h/unit
    # Finishing: ~300 units/8h = 0.0267 h/unit
    # Packing: ~500 units/8h = 0.0160 h/unit
    STANDARD_STAGE_HOURS: Dict[str, float] = {
        "Cutting": 0.0188,
        "Stitching": 0.0444,
        "Finishing": 0.0267,
        "Packing": 0.0160,
    }

    # Factory baseline departmental hourly wage rates in INR
    FACTORY_BASELINE_LABOUR_RATES: Dict[str, float] = {
        "Cutting": 120.0,    # Cutting operators & assistants
        "Stitching": 140.0,  # Industrial sewing operators & tailors
        "Finishing": 110.0,  # Steam press & quality checkers
        "Packing": 95.0,     # Packing and dispatch handlers
    }

    def __init__(self, repository: DataRepository):
        self.repository = repository

    def calculate_labour_costs(
        self,
        stages: List[str],
        order_quantity: int,
        labour_rate_overrides: Optional[Dict[str, Optional[float]]] = None,
    ) -> LabourCostBreakdown:
        """
        Calculate operation labour costs for all stages in product routing.
        If labour rates are missing or undefined for any stage, flags the missing input.
        """
        if not stages:
            stages = ["Cutting", "Stitching", "Finishing", "Packing"]

        items: List[LabourCostItem] = []
        missing_operations: List[str] = []
        has_incomplete = False
        total_labour_cost = 0.0
        total_labour_hours = 0.0

        for stage in stages:
            stage_name = stage.strip()
            hours_per_unit = self.STANDARD_STAGE_HOURS.get(stage_name, 0.025)
            stage_hours = round(order_quantity * hours_per_unit, 2)
            total_labour_hours += stage_hours

            # Determine rate
            rate: Optional[float] = None
            rate_source = "Configured Department Rate"
            status = "VALID"
            missing_reason = None

            if labour_rate_overrides is not None:
                if stage_name in labour_rate_overrides:
                    rate = labour_rate_overrides[stage_name]
                    if rate is not None:
                        rate = float(rate)
                        rate_source = "Order-Specific Override"
                    else:
                        status = "UNAVAILABLE"
                        missing_reason = f"Labour rate for {stage_name} explicitly set to None"
                else:
                    status = "UNAVAILABLE"
                    missing_reason = f"Hourly labour rate missing for operation '{stage_name}'"
            else:
                rate = self.FACTORY_BASELINE_LABOUR_RATES.get(stage_name)
                if rate is None:
                    status = "UNAVAILABLE"
                    missing_reason = f"Standard hourly rate not configured for operation '{stage_name}'"

            line_cost: Optional[float] = None
            if rate is not None and status == "VALID":
                line_cost = round(stage_hours * rate, 2)
                total_labour_cost += line_cost
            else:
                has_incomplete = True
                missing_operations.append(stage_name)

            items.append(
                LabourCostItem(
                    stage=stage_name,
                    operationName=f"{stage_name} Operation",
                    requiredHoursPerUnit=hours_per_unit,
                    totalLabourHours=stage_hours,
                    hourlyRateINR=rate,
                    totalCost=line_cost,
                    currency="INR",
                    rateSource=rate_source,
                    status=status,
                    missingReason=missing_reason,
                )
            )

        status_enum = CostComponentStatus.INCOMPLETE if has_incomplete else CostComponentStatus.COMPLETE
        final_total = round(total_labour_cost, 2) if not has_incomplete else None

        return LabourCostBreakdown(
            status=status_enum,
            operations=items,
            totalCost=final_total,
            totalLabourHours=round(total_labour_hours, 2),
            missingOperations=missing_operations,
        )

