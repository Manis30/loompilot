from typing import Any, Dict, List, Optional, Tuple
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class RiskAnalyzer:
    """
    Evaluates commodity price risk using return-based volatility, forecasted price movements,
    step anomalies, data freshness, and verification status.
    Uses configurable thresholds from settings.
    """

    def __init__(self, config: Optional[Any] = None):
        self.config = config or settings

    def evaluate_risk(
        self,
        analysis_data: Dict[str, Any],
        prediction_data: Dict[str, Any],
    ) -> Tuple[str, List[str], Dict[str, Any]]:
        """
        Synthesize historical price metrics and forecasting projections into a risk tier.
        Returns:
            (risk_level, risk_factors_list, risk_breakdown_dict)
        """
        risk_factors: List[str] = []
        contributions: List[Dict[str, Any]] = []
        total_score = 0

        # Retrieve metrics
        weekly_return_vol = analysis_data.get("weeklyReturnVolatility")
        if weekly_return_vol is None:
            # Fallback if not calculated
            weekly_return_vol = analysis_data.get("historicalVolatilityCV", 0.0) / 4.0

        price_level_cv = analysis_data.get("priceLevelCV", analysis_data.get("historicalVolatilityCV", 0.0))
        is_surge = analysis_data.get("isSuddenSurge", False)
        is_decline = analysis_data.get("isSuddenDecline", False)
        trend = analysis_data.get("trend", "STABLE")
        unverified_count = analysis_data.get("unverifiedObservations", 0)
        n_obs = analysis_data.get("totalObservations", 0)

        predicted_change_pct = prediction_data.get("predictedChangePercentage", 0.0)
        data_freshness_days = prediction_data.get("dataFreshnessDays", 0)
        horizon_days = prediction_data.get("predictionHorizonDays", 15)

        low_vol_thresh = getattr(self.config, "RISK_RETURN_VOLATILITY_LOW_THRESHOLD", 1.0)
        high_vol_thresh = getattr(self.config, "RISK_RETURN_VOLATILITY_HIGH_THRESHOLD", 2.0)
        high_fc_thresh = getattr(self.config, "RISK_FORECAST_INCREASE_HIGH_THRESHOLD", 4.0)
        med_fc_thresh = getattr(self.config, "RISK_FORECAST_INCREASE_MED_THRESHOLD", 2.0)

        # 1. Primary Return-Based Volatility Risk
        vol_score = 0
        vol_desc = "Low return volatility; predictable week-over-week price changes."
        if weekly_return_vol >= high_vol_thresh:
            vol_score = 3
            vol_desc = (
                f"High return volatility: Weekly return standard deviation is {weekly_return_vol:.2f}% "
                f"(threshold: {high_vol_thresh}%)."
            )
            risk_factors.append(vol_desc)
        elif weekly_return_vol >= low_vol_thresh:
            vol_score = 1
            vol_desc = (
                f"Moderate return volatility: Weekly return standard deviation is {weekly_return_vol:.2f}%."
            )
            risk_factors.append(vol_desc)

        total_score += vol_score
        contributions.append({
            "category": "Return Volatility",
            "score": vol_score,
            "metric": f"weeklyReturnVolatility: {weekly_return_vol:.2f}%",
            "description": vol_desc,
        })

        # 2. Forecasted Cost Escalation Risk
        fc_score = 0
        fc_desc = "Projected price movement is stable."
        if predicted_change_pct >= high_fc_thresh:
            fc_score = 3
            fc_desc = (
                f"Significant projected cost inflation: Expected rise of +{predicted_change_pct:.2f}% "
                f"over next {horizon_days} days."
            )
            risk_factors.append(fc_desc)
        elif predicted_change_pct >= med_fc_thresh:
            fc_score = 1
            fc_desc = (
                f"Moderate upward price pressure: Projected change of +{predicted_change_pct:.2f}% "
                f"over {horizon_days} days."
            )
            risk_factors.append(fc_desc)
        elif predicted_change_pct <= -2.0:
            fc_score = 1
            fc_desc = f"Downward price momentum: Projected change of {predicted_change_pct:+.2f}%."
            risk_factors.append(fc_desc)

        total_score += fc_score
        contributions.append({
            "category": "Forecasted Inflation",
            "score": fc_score,
            "metric": f"predictedChangePercentage: {predicted_change_pct:+.2f}%",
            "description": fc_desc,
        })

        # 3. Sudden Step Jumps or Velocity
        velocity_score = 0
        velocity_desc = "No abnormal price surges detected."
        if is_surge:
            velocity_score = 2
            velocity_desc = "Recent sudden price surge detected in latest observation."
            risk_factors.append(velocity_desc)
        elif is_decline:
            velocity_score = 1
            velocity_desc = "Recent sudden price drop detected; potential market instability."
            risk_factors.append(velocity_desc)

        total_score += velocity_score
        contributions.append({
            "category": "Price Velocity",
            "score": velocity_score,
            "metric": f"isSuddenSurge: {is_surge}, isSuddenDecline: {is_decline}",
            "description": velocity_desc,
        })

        # 4. Data Freshness Risk
        freshness_score = 0
        freshness_desc = f"Market data is fresh ({data_freshness_days} days old)."
        if data_freshness_days > self.config.RISK_DATA_STALENESS_DAYS_THRESHOLD:
            freshness_score = 2
            freshness_desc = (
                f"Stale market observation: Latest quote is {data_freshness_days} days old "
                f"(limit: {self.config.RISK_DATA_STALENESS_DAYS_THRESHOLD} days)."
            )
            risk_factors.append(freshness_desc)

        total_score += freshness_score
        contributions.append({
            "category": "Data Freshness",
            "score": freshness_score,
            "metric": f"dataFreshnessDays: {data_freshness_days}",
            "description": freshness_desc,
        })

        # 5. Verification Status Risk
        verification_score = 0
        ver_desc = "All historical observations verified."
        if unverified_count > 0:
            verification_score = 1
            ver_desc = f"{unverified_count} price observations are unverified (marked 'Pending Review')."
            risk_factors.append(ver_desc)

        total_score += verification_score
        contributions.append({
            "category": "Data Verification",
            "score": verification_score,
            "metric": f"unverifiedCount: {unverified_count}",
            "description": ver_desc,
        })

        # 6. Sample Size Risk
        sample_score = 0
        sample_desc = f"Sufficient historical sample size ({n_obs} observations)."
        if n_obs < 6:
            sample_score = 2
            sample_desc = f"Limited historical sample: Only {n_obs} observation(s) available."
            risk_factors.append(sample_desc)

        total_score += sample_score
        contributions.append({
            "category": "Sample Size",
            "score": sample_score,
            "metric": f"observationCount: {n_obs}",
            "description": sample_desc,
        })

        # Final Classification
        if total_score >= 4:
            risk_level = "HIGH"
        elif total_score >= 2:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        if not risk_factors:
            risk_factors.append("Stable market pricing with low volatility and predictable historical patterns.")

        risk_breakdown = {
            "totalRiskScore": total_score,
            "finalRiskLevel": risk_level,
            "contributions": contributions,
        }

        return risk_level, risk_factors, risk_breakdown
