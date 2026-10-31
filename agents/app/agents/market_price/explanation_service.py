from typing import Any, Dict, List, Optional

from app.core.logging import get_logger
from app.llm.groq_client import GroqClient, get_groq_client
from app.llm.prompts.market_price_prompt import (
    SYSTEM_PROMPT_MATERIAL_EXPLANATION,
    SYSTEM_PROMPT_MARKET_MONITORING,
    format_material_prompt,
    format_monitoring_prompt,
)

logger = get_logger(__name__)


class ExplanationService:
    """
    Generates natural-language reasoning and explanations for price analysis results.
    Uses Groq LLM with strict factual constraints and provides robust deterministic
    fallbacks when Groq is unconfigured or unreachable.
    """

    def __init__(self, groq_client: Optional[GroqClient] = None):
        self.groq_client = groq_client or get_groq_client()

    def explain_material_analysis(self, data: Dict[str, Any]) -> str:
        """
        Generate natural language explanation for a single material's price analysis.
        Uses Groq if available; falls back to deterministic rule-based template.
        """
        if self.groq_client.is_configured:
            prompt = format_material_prompt(data)
            completion = self.groq_client.generate_completion(
                system_prompt=SYSTEM_PROMPT_MATERIAL_EXPLANATION,
                user_prompt=prompt,
                temperature=0.2,
                max_tokens=100,
            )
            if completion:
                return completion

        # Deterministic fallback explanation
        return self._generate_fallback_material_explanation(data)

    def explain_market_monitoring(
        self,
        summary: Dict[str, Any],
        alerts: List[Dict[str, Any]],
        materials: List[Dict[str, Any]],
    ) -> str:
        """
        Generate executive overview of periodic market monitoring results.
        Uses Groq if available; falls back to deterministic template.
        """
        if self.groq_client.is_configured:
            prompt = format_monitoring_prompt(summary, alerts, materials)
            completion = self.groq_client.generate_completion(
                system_prompt=SYSTEM_PROMPT_MARKET_MONITORING,
                user_prompt=prompt,
                temperature=0.2,
                max_tokens=400,
            )
            if completion:
                return completion

        return self._generate_fallback_monitoring_explanation(summary, alerts)

    def _generate_fallback_material_explanation(self, data: Dict[str, Any]) -> str:
        """Generate high-fidelity template explanation grounded strictly in calculated metrics."""
        name = data.get("materialName", "Material")
        unit = data.get("unit", "unit")
        curr_price = data.get("currentPrice", 0.0)
        prev_price = data.get("previousPrice", 0.0)
        change_pct = data.get("priceChangePercentage", 0.0)
        trend = data.get("trend", "STABLE")
        price_level_cv = data.get("priceLevelCV", data.get("historicalVolatilityCV", 0.0))
        weekly_return_vol = data.get("weeklyReturnVolatility", 0.0)
        predicted_price = data.get("predictedPrice", curr_price)
        predicted_pct = data.get("predictedChangePercentage", 0.0)
        requested_horizon = data.get("requestedPredictionHorizonDays", data.get("predictionHorizonDays", 15))
        effective_horizon = data.get("effectiveForecastHorizonDays", requested_horizon)
        pred_date = data.get("predictionDate", "")
        risk_level = data.get("riskLevel", "LOW")
        confidence = data.get("confidence", "MEDIUM")
        confidence_breakdown = data.get("confidenceBreakdown", {})
        conf_score = confidence_breakdown.get("totalConfidenceScore", 8)
        risk_factors = data.get("riskFactors", [])

        # Movement descriptor
        direction = "increased" if change_pct > 0 else ("decreased" if change_pct < 0 else "remained steady")
        abs_change = abs(change_pct)

        # Sentence 1: Historical context & current status with correct statistical terms
        p1 = (
            f"{name} is currently priced at {curr_price:.2f} INR/{unit}, having {direction} by "
            f"{abs_change:.2f}% from its prior quote of {prev_price:.2f} INR/{unit}. Over the observation "
            f"period, the commodity has maintained a {trend.lower()} trend with a price-level dispersion "
            f"of {price_level_cv:.2f}% CV and weekly return volatility of {weekly_return_vol:.2f}%."
        )

        # Sentence 2: Forecast projection accounting for requested vs effective horizon
        fc_dir = "rise" if predicted_pct > 0 else ("decline" if predicted_pct < 0 else "remain stable")
        lag_days = max(0, effective_horizon - requested_horizon)
        if lag_days > 0:
            horizon_text = (
                f"For the requested {requested_horizon}-day horizon (target: {pred_date}), accounting for a "
                f"{lag_days}-day observation lag from latest data (effective forecasting span of {effective_horizon} days)"
            )
        else:
            horizon_text = f"Over the requested {requested_horizon}-day forecast horizon (target: {pred_date})"

        p2 = (
            f"{horizon_text}, prices are projected to {fc_dir} by {abs(predicted_pct):.2f}% to approximately "
            f"{predicted_price:.2f} INR/{unit}, evaluated at {confidence.lower()} confidence "
            f"({conf_score}/10 evidence points)."
        )

        # Sentence 3: Risk driver reasoning without verbatim duplicating recommendation
        primary_risk = risk_factors[0] if risk_factors else "stable historical behavior"
        p3 = (
            f"Overall risk is classified as {risk_level}, driven primarily by {primary_risk.lower().rstrip('.')}. "
            f"Procurement planning should factor in supplier delivery lead times to mitigate potential cost escalation."
        )

        return f"{p1} {p2} {p3}"

    def _generate_fallback_monitoring_explanation(
        self, summary: Dict[str, Any], alerts: List[Dict[str, Any]]
    ) -> str:
        """Generate executive summary fallback for market monitoring."""
        total = summary.get("totalMaterialsAnalyzed", 0)
        high = summary.get("highRiskMaterials", 0)
        med = summary.get("mediumRiskMaterials", 0)
        low = summary.get("lowRiskMaterials", 0)
        upward = summary.get("upwardTrendMaterials", 0)

        alert_count = len(alerts)

        return (
            f"Periodic market price monitoring evaluated {total} raw materials across the active catalog. "
            f"Currently, {high} materials are classified at HIGH risk, {med} at MEDIUM risk, and {low} at LOW risk, "
            f"with {upward} materials exhibiting sustained upward price momentum. A total of {alert_count} active "
            f"market alerts were generated. Procurement leadership should prioritize hedging and forward contracting "
            f"for high-risk commodities while scheduling standard replenishment for stable categories."
        )

