from datetime import datetime
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd

from app.core.config import settings
from app.core.logging import get_logger
from app.utils.math_helpers import (
    calculate_linear_regression,
    calculate_return_volatility,
    calculate_volatility_cv,
    detect_price_anomaly,
    safe_round,
)

logger = get_logger(__name__)


class PriceAnalyzer:
    """
    Executes rigorous statistical analysis on historical material price time-series.
    Calculates moving averages, volatility, rate of change, and trend direction.
    """

    def __init__(self, config: Optional[Any] = None):
        self.config = config or settings

    def analyze_history(self, history_df: pd.DataFrame) -> Dict[str, Any]:
        """
        Analyze chronological historical price observations.
        Expects history_df with columns: ['ObservationDate', 'UnitPriceINR', 'VerificationStatus']
        """
        if history_df.empty:
            raise ValueError("Cannot analyze empty price history DataFrame.")

        # Ensure sorted chronologically and dates are pandas Timestamp
        df = history_df.copy()
        df["ObservationDate"] = pd.to_datetime(df["ObservationDate"])
        df = df.sort_values(by="ObservationDate").reset_index(drop=True)
        prices = df["UnitPriceINR"].astype(float).tolist()
        dates = df["ObservationDate"].tolist()
        n_obs = len(prices)

        latest_price = prices[-1]
        latest_date = dates[-1]

        # 1. Previous observation metrics
        if n_obs >= 2:
            prev_price = prices[-2]
            prev_date = dates[-2]
            delta_days = max(1, (latest_date - prev_date).days)
            price_change = latest_price - prev_price
            price_change_pct = (price_change / prev_price) * 100.0 if prev_price > 0 else 0.0
            # Daily equivalent percentage change
            daily_change_pct = price_change_pct / delta_days
        else:
            prev_price = latest_price
            price_change = 0.0
            price_change_pct = 0.0
            daily_change_pct = 0.0
            delta_days = 0

        # 2. Moving Averages
        # 7-day average: observations in the last 7 calendar days
        cutoff_7d = latest_date - pd.Timedelta(days=7)
        obs_7d = df[df["ObservationDate"] >= cutoff_7d]["UnitPriceINR"].tolist()
        seven_day_avg = float(np.mean(obs_7d)) if obs_7d else latest_price

        # 30-day average: observations in the last 30 calendar days
        cutoff_30d = latest_date - pd.Timedelta(days=30)
        obs_30d = df[df["ObservationDate"] >= cutoff_30d]["UnitPriceINR"].tolist()
        thirty_day_avg = float(np.mean(obs_30d)) if obs_30d else latest_price

        # 3. Monthly price movement (change over ~30 days)
        # Find price from observation closest to 30 days prior
        obs_prior_30 = df[df["ObservationDate"] <= cutoff_30d]
        if not obs_prior_30.empty:
            price_month_ago = float(obs_prior_30.iloc[-1]["UnitPriceINR"])
            monthly_price_movement = latest_price - price_month_ago
            monthly_change_pct = ((latest_price - price_month_ago) / price_month_ago) * 100.0 if price_month_ago > 0 else 0.0
        elif n_obs >= 4:
            # Fallback to ~4 observations back if exact 30 days window falls before data start
            price_month_ago = prices[-4]
            monthly_price_movement = latest_price - price_month_ago
            monthly_change_pct = ((latest_price - price_month_ago) / price_month_ago) * 100.0 if price_month_ago > 0 else 0.0
        else:
            monthly_price_movement = price_change
            monthly_change_pct = price_change_pct

        # 4. Range and Volatility (Price Level Dispersion and Return-Based Volatility)
        min_price = float(np.min(prices))
        max_price = float(np.max(prices))
        price_level_cv = calculate_volatility_cv(prices)

        # Estimate median sampling interval
        interval_days = 7.0
        if n_obs >= 2:
            diffs = [(dates[i] - dates[i - 1]).days for i in range(1, n_obs)]
            interval_days = float(np.median(diffs)) if diffs else 7.0

        weekly_return_vol, daily_return_vol, returns_list = calculate_return_volatility(
            prices, interval_days=interval_days
        )

        # 5. Trend Analysis (Linear Regression & Slope)
        trend = "STABLE"
        slope = 0.0
        r_squared = 0.0
        if n_obs >= 3:
            # Time indices in steps
            x_indices = list(range(n_obs))
            slope, intercept, r_squared, p_value, stderr = calculate_linear_regression(x_indices, prices)

            overall_pct_change = ((latest_price - prices[0]) / prices[0]) * 100.0 if prices[0] > 0 else 0.0

            # Trend threshold: sustained move > 2% and consistent direction
            if slope > 0 and overall_pct_change >= 2.0:
                trend = "UPWARD"
            elif slope < 0 and overall_pct_change <= -2.0:
                trend = "DOWNWARD"
            else:
                trend = "STABLE"

        # 6. Sudden jumps / declines detection
        is_surge, is_decline, step_pct = detect_price_anomaly(
            prices,
            threshold_z=2.0,
            min_pct_jump=self.config.RISK_PRICE_CHANGE_HIGH_THRESHOLD
        )

        # Return-based unusual fluctuations
        unusual_fluctuations = (
            weekly_return_vol >= getattr(self.config, "RISK_RETURN_VOLATILITY_HIGH_THRESHOLD", 2.0)
            or is_surge
            or is_decline
        )

        # 7. Verification Status breakdown
        unverified_count = 0
        if "VerificationStatus" in df.columns:
            unverified_count = int((df["VerificationStatus"] != "Verified").sum())

        return {
            "latestPrice": safe_round(latest_price, 2),
            "previousPrice": safe_round(prev_price, 2),
            "priceChange": safe_round(price_change, 2),
            "priceChangePercentage": safe_round(price_change_pct, 2),
            "dailyChangePercentage": safe_round(daily_change_pct, 3),
            "sevenDayAveragePrice": safe_round(seven_day_avg, 2),
            "thirtyDayAveragePrice": safe_round(thirty_day_avg, 2),
            "monthlyPriceMovement": safe_round(monthly_price_movement, 2),
            "monthlyChangePercentage": safe_round(monthly_change_pct, 2),
            "minHistoricalPrice": safe_round(min_price, 2),
            "maxHistoricalPrice": safe_round(max_price, 2),
            "priceLevelCV": safe_round(price_level_cv, 2),
            "historicalVolatilityCV": safe_round(price_level_cv, 2),  # Backward compatibility alias
            "weeklyReturnVolatility": safe_round(weekly_return_vol, 2),
            "dailyReturnVolatility": safe_round(daily_return_vol, 2),
            "trend": trend,
            "trendSlope": safe_round(slope, 4),
            "trendRSquared": safe_round(r_squared, 4),
            "isSuddenSurge": is_surge,
            "isSuddenDecline": is_decline,
            "unusualFluctuations": unusual_fluctuations,
            "totalObservations": n_obs,
            "latestObservationDate": latest_date.strftime("%Y-%m-%d"),
            "observationGapDays": delta_days,
            "unverifiedObservations": unverified_count,
        }
