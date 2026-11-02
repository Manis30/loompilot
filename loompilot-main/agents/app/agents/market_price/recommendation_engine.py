from typing import Any, Dict, Optional
from app.core.logging import get_logger

logger = get_logger(__name__)


class RecommendationEngine:
    """
    Synthesizes numerical price analysis, trend direction, risk level,
    and supplier lead times into actionable, management-facing purchasing recommendations.
    Advisory decision-support only; never triggers automated purchase orders.
    """

    def generate_recommendation(
        self,
        material_name: str,
        current_price: float,
        predicted_price: float,
        predicted_change_pct: float,
        trend: str,
        risk_level: str,
        confidence: str,
        volatility_cv: float,
        is_surge: bool = False,
        is_decline: bool = False,
        supplier_info: Optional[Dict[str, Any]] = None,
        current_stock: Optional[float] = None,
        unit: str = "units",
    ) -> str:
        """
        Generate contextual, management-friendly purchasing guidance.
        """
        supplier_name = (
            supplier_info.get("SupplierName")
            or supplier_info.get("supplierName")
            if supplier_info
            else "preferred supplier"
        )
        lead_time = (
            supplier_info.get("LeadTimeDays")
            or supplier_info.get("leadTimeDays")
            if supplier_info
            else None
        )
        lead_time_str = f" (Supplier lead time: {lead_time} days)" if lead_time else ""

        # Condition 1: Low Confidence / High Uncertainty
        if confidence == "LOW":
            return (
                f"High price uncertainty: Historical data confidence is low. Request direct, updated "
                f"quotations from {supplier_name}{lead_time_str} before committing to purchase orders."
            )

        # Condition 2: Sudden Surge Anomaly
        if is_surge:
            return (
                f"Exercise caution: Sudden price surge detected. Defer speculative bulk orders and request "
                f"fresh spot quotations from {supplier_name}. Fulfill only immediate production requirements "
                f"to hedge against price volatility."
            )

        # Condition 3: High Risk with Upward Price Inflation
        if risk_level == "HIGH" and predicted_change_pct > 1.5:
            return (
                f"Consider purchasing required quantities earlier: {material_name} is experiencing strong upward "
                f"cost pressure with a forecasted increase of +{predicted_change_pct:.2f}% to {predicted_price:.2f} INR/{unit}. "
                f"Locking orders earlier with {supplier_name}{lead_time_str} will protect factory profit margins."
            )

        # Condition 4: Downward Trend
        if trend == "DOWNWARD" or predicted_change_pct < -1.5:
            return (
                f"Wait and monitor if prices are declining: {material_name} demonstrates downward price momentum "
                f"({predicted_change_pct:+.2f}% projected change). Maintain lean inventory and defer non-urgent bulk "
                f"purchases to capitalize on anticipated lower procurement rates."
            )

        # Condition 5: Medium Risk with Upward Movement
        if risk_level == "MEDIUM" and trend == "UPWARD":
            return (
                f"Monitor the price before purchasing: Moderate upward price movement is projected (+{predicted_change_pct:.2f}%). "
                f"Review current warehouse stock{f' ({current_stock:,.0f} {unit})' if current_stock is not None else ''} "
                f"and prepare procurement requisitions if buffer stock is depleted{lead_time_str}."
            )

        # Condition 6: Highly Stable with Low Risk
        if risk_level == "LOW" and trend == "STABLE":
            return (
                f"Consider purchasing now based on standard production schedule: {material_name} prices are steady "
                f"(volatility: {volatility_cv:.2f}% CV). Current rate of {current_price:.2f} INR/{unit} is stable, "
                f"supporting predictable cost budgeting."
            )

        # Default Balanced Recommendation
        return (
            f"Monitor price stability: {material_name} is trading at {current_price:.2f} INR/{unit} with a projected change "
            f"of {predicted_change_pct:+.2f}%. Execute standard replenishment according to confirmed production milestones."
        )
