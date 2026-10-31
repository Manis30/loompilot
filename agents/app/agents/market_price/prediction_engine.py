import math
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd

from app.core.config import settings
from app.core.logging import get_logger
from app.utils.math_helpers import calculate_volatility_cv, safe_round

logger = get_logger(__name__)


class InsufficientDataWarning(UserWarning):
    """Warning emitted when historical data is too sparse for high-confidence forecasting."""
    pass


class PredictionEngine:
    """
    Time-series forecasting engine for textile raw material price forecasting.
    Employs Double Exponential Smoothing (Holt's Linear Model) with grid-search
    parameter tuning and analytical prediction intervals.
    """

    def __init__(self, config: Optional[Any] = None):
        self.config = config or settings

    def _estimate_frequency_days(self, dates: List[datetime]) -> float:
        """Estimate median days between consecutive observations."""
        if len(dates) < 2:
            return 7.0
        diffs = [(dates[i] - dates[i-1]).days for i in range(1, len(dates))]
        median_diff = float(np.median(diffs))
        return max(1.0, median_diff)

    def _fit_holt_linear(
        self, prices: List[float], horizon_periods: float
    ) -> Tuple[float, float, float, Tuple[float, float]]:
        """
        Fit Holt's Linear Exponential Smoothing model via sum of squared errors minimization.
        Returns: (forecast, in_sample_mape, residual_std, (alpha, beta))
        """
        n = len(prices)
        if n < 2:
            return prices[-1], 0.0, 0.0, (0.5, 0.2)

        best_sse = float("inf")
        best_alpha = 0.5
        best_beta = 0.2

        # Grid search over reasonable parameter space
        alpha_candidates = [0.1, 0.2, 0.4, 0.6, 0.8]
        beta_candidates = [0.05, 0.1, 0.2, 0.3]

        for alpha in alpha_candidates:
            for beta in beta_candidates:
                level = prices[0]
                trend = prices[1] - prices[0]
                sse = 0.0
                for t in range(1, n):
                    y_hat = level + trend
                    err = prices[t] - y_hat
                    sse += err * err
                    new_level = alpha * prices[t] + (1 - alpha) * (level + trend)
                    new_trend = beta * (new_level - level) + (1 - beta) * trend
                    level, trend = new_level, new_trend

                if sse < best_sse:
                    best_sse = sse
                    best_alpha, best_beta = alpha, beta

        # Run final pass with best parameters
        level = prices[0]
        trend = prices[1] - prices[0]
        residuals: List[float] = []
        percentage_errors: List[float] = []

        for t in range(1, n):
            y_hat = level + trend
            err = prices[t] - y_hat
            residuals.append(err)
            if abs(prices[t]) > 1e-9:
                percentage_errors.append(abs(err / prices[t]) * 100.0)

            new_level = best_alpha * prices[t] + (1 - best_alpha) * (level + trend)
            new_trend = best_beta * (new_level - level) + (1 - best_beta) * trend
            level, trend = new_level, new_trend

        # Multi-step ahead forecast
        forecast = level + horizon_periods * trend

        # Ensure forecast does not collapse below 0 for physical raw materials
        forecast = max(0.01, float(forecast))

        mape = float(np.mean(percentage_errors)) if percentage_errors else 0.0
        residual_std = float(np.std(residuals, ddof=1)) if len(residuals) > 1 else 0.0

        return forecast, mape, residual_std, (best_alpha, best_beta)

    def _backtest_holt_linear(
        self, prices: List[float], holdout_periods: int = 4
    ) -> Tuple[float, int]:
        """
        Perform out-of-sample time-series holdout validation.
        Splits price series into training set (N - k) and testing set (k).
        Returns: (backtest_mape, holdout_count)
        """
        n = len(prices)
        if n < 8:
            return 0.0, 0

        k = min(holdout_periods, max(2, n // 5))
        train_prices = prices[:-k]
        test_prices = prices[-k:]

        # Fit Holt parameters on train_prices
        best_sse = float("inf")
        best_alpha = 0.5
        best_beta = 0.2

        for a in [0.2, 0.4, 0.6]:
            for b in [0.05, 0.1, 0.2]:
                l = train_prices[0]
                tr = train_prices[1] - train_prices[0]
                sse = 0.0
                for t in range(1, len(train_prices)):
                    y_hat = l + tr
                    err = train_prices[t] - y_hat
                    sse += err * err
                    nl = a * train_prices[t] + (1 - a) * (l + tr)
                    tr = b * (nl - l) + (1 - b) * tr
                    l = nl
                if sse < best_sse:
                    best_sse = sse
                    best_alpha, best_beta = a, b

        # Compute level and trend up to end of train_prices
        l = train_prices[0]
        tr = train_prices[1] - train_prices[0]
        for t in range(1, len(train_prices)):
            nl = best_alpha * train_prices[t] + (1 - best_alpha) * (l + tr)
            tr = best_beta * (nl - l) + (1 - best_beta) * tr
            l = nl

        # Forecast forward for test_prices
        errors = []
        for step in range(1, k + 1):
            y_pred = l + step * tr
            actual = test_prices[step - 1]
            if actual > 1e-9:
                errors.append(abs((actual - y_pred) / actual) * 100.0)

        backtest_mape = float(np.mean(errors)) if errors else 0.0
        return backtest_mape, k

    def calculate_confidence_breakdown(
        self,
        n_obs: int,
        mape: float,
        weekly_return_vol: float,
        staleness_days: int,
        r_squared: float,
        backtest_mape: Optional[float] = None,
        holdout_count: int = 0,
    ) -> Dict[str, Any]:
        """
        Calculate transparent scoring breakdown across 4 evidence dimensions:
        1. sampleSizeScore (max 3)
        2. modelFitScore (max 3) - evaluates in-sample MAPE, backtest MAPE, and R2
        3. volatilityScore (max 2) - based on return volatility
        4. freshnessScore (max 2)
        Total confidence score: 0 to 10 points.
        Includes strict R2 model-fit safeguard: low R2 (< MIN_R2_FOR_HIGH_CONFIDENCE) cannot receive HIGH confidence.
        """
        sample_size_score = 0
        if n_obs >= 18:
            sample_size_score = 3
        elif n_obs >= 10:
            sample_size_score = 2
        elif n_obs >= self.config.MIN_OBSERVATIONS_FOR_PREDICTION:
            sample_size_score = 1
        else:
            sample_size_score = 0

        # Out-of-sample backtesting validation
        effective_backtest = backtest_mape if backtest_mape is not None and holdout_count > 0 else mape
        model_fit_score = 0
        if mape <= 2.5 and r_squared >= 0.70 and effective_backtest <= 3.5:
            model_fit_score = 3
        elif mape <= 4.5 and r_squared >= 0.40 and effective_backtest <= 6.0:
            model_fit_score = 2
        elif mape <= 8.0 and r_squared >= 0.20:
            model_fit_score = 1
        else:
            model_fit_score = 0

        volatility_score = 0
        low_vol_thresh = getattr(self.config, "RISK_RETURN_VOLATILITY_LOW_THRESHOLD", 1.0)
        high_vol_thresh = getattr(self.config, "RISK_RETURN_VOLATILITY_HIGH_THRESHOLD", 2.0)
        if weekly_return_vol <= low_vol_thresh:
            volatility_score = 2
        elif weekly_return_vol <= high_vol_thresh:
            volatility_score = 1
        else:
            volatility_score = 0

        freshness_score = 0
        if staleness_days <= 7:
            freshness_score = 2
        elif staleness_days <= self.config.RISK_DATA_STALENESS_DAYS_THRESHOLD:
            freshness_score = 1
        else:
            freshness_score = 0

        total_score = sample_size_score + model_fit_score + volatility_score + freshness_score

        # Strict R2 and model-fit safeguard
        r2_safeguard_triggered = False
        min_r2_for_high = getattr(self.config, "MIN_R2_FOR_HIGH_CONFIDENCE", 0.35)
        if r_squared < min_r2_for_high:
            r2_safeguard_triggered = True

        # Rule-based final confidence determination
        if n_obs < self.config.MIN_OBSERVATIONS_FOR_PREDICTION:
            final_level = "LOW"
        elif staleness_days > (self.config.RISK_DATA_STALENESS_DAYS_THRESHOLD * 2):
            final_level = "LOW"
        elif total_score >= 8 and sample_size_score >= 2 and model_fit_score >= 2 and not r2_safeguard_triggered:
            final_level = "HIGH"
        elif total_score >= 5 or (total_score >= 8 and r2_safeguard_triggered):
            # If total score was high but capped by R2 safeguard, assign MEDIUM (never HIGH)
            final_level = "MEDIUM"
        else:
            final_level = "LOW"

        return {
            "observationCount": n_obs,
            "MAPE": safe_round(mape, 2) or 0.0,
            "backtestMape": safe_round(backtest_mape, 2) if backtest_mape is not None else safe_round(mape, 2),
            "R2": safe_round(r_squared, 4) or 0.0,
            "dataFreshnessDays": staleness_days,
            "volatilityScore": volatility_score,
            "sampleSizeScore": sample_size_score,
            "modelFitScore": model_fit_score,
            "freshnessScore": freshness_score,
            "totalConfidenceScore": total_score,
            "r2SafeguardTriggered": r2_safeguard_triggered,
            "holdoutObservations": holdout_count,
            "finalConfidenceLevel": final_level,
        }

    def _determine_confidence(
        self,
        n_obs: int,
        mape: float,
        volatility_cv: float,
        staleness_days: int,
        r_squared: float,
    ) -> str:
        """Backward compatibility wrapper returning final confidence tier."""
        breakdown = self.calculate_confidence_breakdown(
            n_obs=n_obs,
            mape=mape,
            weekly_return_vol=volatility_cv / 4.0,  # approximate fallback
            staleness_days=staleness_days,
            r_squared=r_squared,
        )
        return breakdown["finalConfidenceLevel"]

    def predict(
        self,
        history_df: pd.DataFrame,
        horizon_days: int = 15,
        analysis_date: Optional[Union[date, datetime, str]] = None,
        trend_r_squared: float = 0.0,
        weekly_return_volatility: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Generate price forecast for the specified horizon in days.
        Treats horizon_days as requestedPredictionHorizonDays (days after analysisDate).
        Calculates effectiveForecastHorizonDays from latestObservationDate to target predictionDate.
        """
        if history_df.empty:
            raise ValueError("Cannot forecast price on empty historical series.")

        df = history_df.copy()
        df["ObservationDate"] = pd.to_datetime(df["ObservationDate"])
        df = df.sort_values(by="ObservationDate").reset_index(drop=True)
        prices = df["UnitPriceINR"].astype(float).tolist()
        dates = df["ObservationDate"].tolist()
        n_obs = len(prices)

        latest_obs_date = dates[-1].date()
        current_price = prices[-1]

        # 1. Determine anchor analysis date
        if analysis_date is not None:
            if isinstance(analysis_date, str):
                anchor_date = datetime.strptime(analysis_date, "%Y-%m-%d").date()
            elif isinstance(analysis_date, datetime):
                anchor_date = analysis_date.date()
            else:
                anchor_date = analysis_date
        else:
            anchor_date = latest_obs_date

        # 2. Target prediction date (measured from analysisDate)
        requested_horizon_days = max(1, int(horizon_days))
        target_prediction_date = anchor_date + timedelta(days=requested_horizon_days)

        # 3. Effective forecast horizon (measured from latest available observation date)
        effective_forecast_horizon_days = max(1, (target_prediction_date - latest_obs_date).days)
        staleness_days = max(0, (anchor_date - latest_obs_date).days)

        warnings: List[str] = []

        # If return volatility was not passed, compute it
        if weekly_return_volatility is None:
            returns = [
                ((prices[i] - prices[i - 1]) / prices[i - 1]) * 100.0
                for i in range(1, len(prices))
                if abs(prices[i - 1]) > 1e-9
            ]
            weekly_return_vol = float(np.std(returns, ddof=1)) if len(returns) > 1 else 0.0
        else:
            weekly_return_vol = weekly_return_volatility

        # Check for insufficient data
        if n_obs < self.config.MIN_OBSERVATIONS_FOR_PREDICTION:
            warning_msg = (
                f"Insufficient historical observations ({n_obs} available, "
                f"minimum {self.config.MIN_OBSERVATIONS_FOR_PREDICTION} required). "
                "Prediction held constant at latest price with elevated uncertainty."
            )
            warnings.append(warning_msg)
            logger.warning(warning_msg)

            margin = current_price * 0.10
            confidence_breakdown = self.calculate_confidence_breakdown(
                n_obs=n_obs,
                mape=0.0,
                weekly_return_vol=weekly_return_vol,
                staleness_days=staleness_days,
                r_squared=0.0,
                backtest_mape=0.0,
                holdout_count=0,
            )

            horizon_explanation = (
                f"Requested {requested_horizon_days}-day horizon after analysis date {anchor_date.strftime('%Y-%m-%d')} "
                f"targets {target_prediction_date.strftime('%Y-%m-%d')}. "
                f"Accounting for a {staleness_days}-day observation lag from latest actual data on {latest_obs_date.strftime('%Y-%m-%d')}, "
                f"the effective forecasting span is {effective_forecast_horizon_days} days."
            )

            return {
                "predictedPrice": safe_round(current_price, 2),
                "predictedChangePercentage": 0.0,
                "latestObservationDate": latest_obs_date.strftime("%Y-%m-%d"),
                "analysisDate": anchor_date.strftime("%Y-%m-%d"),
                "dataLagDays": staleness_days,
                "requestedPredictionHorizonDays": requested_horizon_days,
                "effectiveForecastHorizonDays": effective_forecast_horizon_days,
                "predictionHorizonDays": requested_horizon_days,
                "predictionDate": target_prediction_date.strftime("%Y-%m-%d"),
                "horizonExplanation": horizon_explanation,
                "lowerConfidenceBound": safe_round(max(0.01, current_price - margin), 2),
                "upperConfidenceBound": safe_round(current_price + margin, 2),
                "confidence": "LOW",
                "confidenceBreakdown": confidence_breakdown,
                "inSampleMape": 0.0,
                "backtestMape": 0.0,
                "warnings": warnings,
                "anchorDate": anchor_date.strftime("%Y-%m-%d"),
                "dataFreshnessDays": staleness_days,
            }

        # 4. Estimate sampling interval (in days)
        freq_days = self._estimate_frequency_days(dates)

        # 5. Effective periods forward from the latest available observation
        effective_horizon_periods = max(0.1, effective_forecast_horizon_days / freq_days)

        # 6. Fit Holt's Linear Exponential Smoothing using effective horizon
        forecast_price, mape, residual_std, params = self._fit_holt_linear(prices, effective_horizon_periods)

        # 7. Out-of-sample holdout validation / backtesting
        backtest_mape, holdout_count = self._backtest_holt_linear(
            prices, holdout_periods=getattr(self.config, "HOLDOUT_BACKTEST_PERIODS", 4)
        )

        # 8. Prediction Interval
        horizon_expansion = math.sqrt(1.0 + (effective_horizon_periods / max(1, n_obs)))
        forecast_se = residual_std * horizon_expansion
        z_multiplier = 1.96
        lower_bound = max(0.01, forecast_price - z_multiplier * forecast_se)
        upper_bound = forecast_price + z_multiplier * forecast_se

        predicted_change = forecast_price - current_price
        predicted_change_pct = (predicted_change / current_price) * 100.0 if current_price > 0 else 0.0

        confidence_breakdown = self.calculate_confidence_breakdown(
            n_obs=n_obs,
            mape=mape,
            weekly_return_vol=weekly_return_vol,
            staleness_days=staleness_days,
            r_squared=trend_r_squared,
            backtest_mape=backtest_mape,
            holdout_count=holdout_count,
        )

        horizon_explanation = (
            f"Requested {requested_horizon_days}-day horizon after analysis date {anchor_date.strftime('%Y-%m-%d')} "
            f"targets {target_prediction_date.strftime('%Y-%m-%d')}. "
            f"Accounting for a {staleness_days}-day observation lag from latest actual data on {latest_obs_date.strftime('%Y-%m-%d')}, "
            f"the effective forecasting span is {effective_forecast_horizon_days} days."
        )

        if staleness_days > self.config.RISK_DATA_STALENESS_DAYS_THRESHOLD:
            warnings.append(
                f"Data freshness alert: latest observation is {staleness_days} days old "
                f"(threshold: {self.config.RISK_DATA_STALENESS_DAYS_THRESHOLD} days)."
            )

        return {
            "predictedPrice": safe_round(forecast_price, 2),
            "predictedChangePercentage": safe_round(predicted_change_pct, 2),
            "latestObservationDate": latest_obs_date.strftime("%Y-%m-%d"),
            "analysisDate": anchor_date.strftime("%Y-%m-%d"),
            "dataLagDays": staleness_days,
            "requestedPredictionHorizonDays": requested_horizon_days,
            "effectiveForecastHorizonDays": effective_forecast_horizon_days,
            "predictionHorizonDays": requested_horizon_days,
            "predictionDate": target_prediction_date.strftime("%Y-%m-%d"),
            "horizonExplanation": horizon_explanation,
            "lowerConfidenceBound": safe_round(lower_bound, 2),
            "upperConfidenceBound": safe_round(upper_bound, 2),
            "confidence": confidence_breakdown["finalConfidenceLevel"],
            "confidenceBreakdown": confidence_breakdown,
            "inSampleMape": safe_round(mape, 2),
            "backtestMape": safe_round(backtest_mape, 2),
            "warnings": warnings,
            "anchorDate": anchor_date.strftime("%Y-%m-%d"),
            "dataFreshnessDays": staleness_days,
        }

