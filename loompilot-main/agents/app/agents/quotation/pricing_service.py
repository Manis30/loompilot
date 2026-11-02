from typing import Any, Dict, Optional, Tuple

from app.core.logging import get_logger
from app.schemas.quotation_schema import PricingMethod

logger = get_logger(__name__)


class PricingService:
    """
    Computes total manufacturing production cost, markup vs gross margin calculations,
    and unit prices with strict financial precision.
    """

    @staticmethod
    def calculate_total_production_cost(
        material_cost: Optional[float],
        labour_cost: Optional[float],
        machine_cost: Optional[float],
        overhead_cost: Optional[float],
        additional_cost: Optional[float] = 0.0,
        order_quantity: int = 1,
    ) -> Tuple[Optional[float], Optional[float]]:
        """
        Compute total production cost and cost per unit.
        Returns (total_production_cost, production_cost_per_unit).
        If any mandatory direct production cost component is missing, returns (None, None).
        """
        if (
            material_cost is None
            or labour_cost is None
            or machine_cost is None
            or overhead_cost is None
        ):
            return None, None

        add_cost = additional_cost or 0.0
        total_cost = round(
            float(material_cost)
            + float(labour_cost)
            + float(machine_cost)
            + float(overhead_cost)
            + float(add_cost),
            2,
        )
        cost_per_unit = round(total_cost / max(1, order_quantity), 2)
        return total_cost, cost_per_unit

    @staticmethod
    def calculate_selling_price(
        total_production_cost: Optional[float],
        pricing_method: PricingMethod,
        margin_percentage: Optional[float],
        order_quantity: int,
    ) -> Tuple[Optional[float], Optional[float], Optional[float]]:
        """
        Calculate:
          - Selling Price Before Tax
          - Selling Price Per Unit
          - Margin Amount in INR
        Distinguishes strictly between MARKUP and GROSS_MARGIN.
        Returns (selling_price_before_tax, selling_price_per_unit, margin_amount).
        """
        if total_production_cost is None or margin_percentage is None:
            return None, None, None

        cost = float(total_production_cost)
        margin_pct = float(margin_percentage)

        if pricing_method == PricingMethod.MARKUP:
            # Selling Price = Cost * (1 + Markup% / 100)
            selling_price = round(cost * (1.0 + (margin_pct / 100.0)), 2)
            margin_amount = round(selling_price - cost, 2)

        elif pricing_method == PricingMethod.GROSS_MARGIN:
            # Selling Price = Cost / (1 - GrossMargin% / 100)
            if margin_pct >= 100.0:
                raise ValueError("Gross margin percentage must be strictly less than 100%.")
            selling_price = round(cost / (1.0 - (margin_pct / 100.0)), 2)
            margin_amount = round(selling_price - cost, 2)

        else:
            raise ValueError(f"Unsupported pricing method: {pricing_method}")

        selling_price_per_unit = round(selling_price / max(1, order_quantity), 2)
        return selling_price, selling_price_per_unit, margin_amount

