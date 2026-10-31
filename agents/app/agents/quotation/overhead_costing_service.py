from typing import Any, Dict, List, Optional

from app.core.logging import get_logger
from app.schemas.quotation_schema import (
    CostComponentStatus,
    OverheadAllocationMethod,
    OverheadCostBreakdown,
    OverheadCostItem,
    OverheadConfigRequest,
)

logger = get_logger(__name__)


class OverheadCostingService:
    """
    Allocates indirect factory manufacturing overheads (rent, factory administration,
    building maintenance, utilities) to the production order using configured rules.
    """

    # Standard factory overhead breakdown proportions
    OVERHEAD_COMPONENTS = [
        ("Factory Facility & Rent", 0.35, "Allocation of facility lease and plant infrastructure"),
        ("Factory Electricity & Utilities", 0.30, "Power distribution, lighting, and auxiliary plant water"),
        ("Supervision & Factory Administration", 0.20, "Floor supervisors, shift managers, and production admin"),
        ("Plant Maintenance & Consumables", 0.15, "Tooling, factory maintenance, and cleaning consumables"),
    ]

    # Standard factory default overhead rule (10.0% of direct manufacturing cost)
    DEFAULT_OVERHEAD_RULE = OverheadConfigRequest(
        method=OverheadAllocationMethod.PERCENTAGE_OF_DIRECT_COST,
        rate=10.0,
        description="Standard 10% direct cost factory overhead allocation",
    )

    def calculate_overhead(
        self,
        order_quantity: int,
        direct_material_cost: Optional[float],
        direct_labour_cost: Optional[float],
        total_labour_hours: Optional[float] = None,
        total_machine_hours: Optional[float] = None,
        config: Optional[OverheadConfigRequest] = None,
        allow_default: bool = True,
    ) -> OverheadCostBreakdown:
        """
        Calculate manufacturing overhead using the specified or default allocation method.
        If no overhead rule exists or is unconfigured, marks overhead as UNAVAILABLE.
        """
        active_config = config
        if active_config is None:
            if allow_default:
                active_config = self.DEFAULT_OVERHEAD_RULE
            else:
                return OverheadCostBreakdown(
                    status=CostComponentStatus.UNAVAILABLE,
                    items=[],
                    totalCost=None,
                    allocationMethod="UNCONFIGURED",
                )

        method = active_config.method
        rate = active_config.rate
        total_overhead: Optional[float] = None
        basis_amount: Optional[float] = None

        if method == OverheadAllocationMethod.PERCENTAGE_OF_DIRECT_COST:
            if direct_material_cost is None or direct_labour_cost is None:
                # Direct cost missing -> cannot compute percentage overhead
                return OverheadCostBreakdown(
                    status=CostComponentStatus.INCOMPLETE,
                    items=[],
                    totalCost=None,
                    allocationMethod=str(method.value),
                )
            basis_amount = round(direct_material_cost + direct_labour_cost, 2)
            total_overhead = round(basis_amount * (rate / 100.0), 2)

        elif method == OverheadAllocationMethod.COST_PER_LABOUR_HOUR:
            if total_labour_hours is None:
                return OverheadCostBreakdown(
                    status=CostComponentStatus.INCOMPLETE,
                    items=[],
                    totalCost=None,
                    allocationMethod=str(method.value),
                )
            basis_amount = total_labour_hours
            total_overhead = round(total_labour_hours * rate, 2)

        elif method == OverheadAllocationMethod.COST_PER_MACHINE_HOUR:
            if total_machine_hours is None:
                return OverheadCostBreakdown(
                    status=CostComponentStatus.INCOMPLETE,
                    items=[],
                    totalCost=None,
                    allocationMethod=str(method.value),
                )
            basis_amount = total_machine_hours
            total_overhead = round(total_machine_hours * rate, 2)

        elif method == OverheadAllocationMethod.COST_PER_FINISHED_UNIT:
            basis_amount = float(order_quantity)
            total_overhead = round(order_quantity * rate, 2)

        elif method == OverheadAllocationMethod.FIXED_AMOUNT:
            basis_amount = 1.0
            total_overhead = round(rate, 2)

        # Build transparent subcomponent breakdown
        items: List[OverheadCostItem] = []
        for name, pct, note in self.OVERHEAD_COMPONENTS:
            sub_cost = round(total_overhead * pct, 2) if total_overhead is not None else None
            items.append(
                OverheadCostItem(
                    component=name,
                    allocationMethod=str(method.value),
                    basisAmount=basis_amount,
                    appliedRate=round(rate * pct, 2) if method == OverheadAllocationMethod.PERCENTAGE_OF_DIRECT_COST else rate,
                    allocatedCost=sub_cost,
                    currency="INR",
                    notes=note,
                )
            )

        return OverheadCostBreakdown(
            status=CostComponentStatus.COMPLETE if total_overhead is not None else CostComponentStatus.INCOMPLETE,
            items=items,
            totalCost=total_overhead,
            allocationMethod=str(method.value),
        )

