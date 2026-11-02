from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple, Union
from app.core.config import settings
from app.core.logging import get_logger
from app.schemas.market_price_schema import MaterialPriceResult, PriceAlert

logger = get_logger(__name__)


class AlertManager:
    """
    Manages active price alerts and historical alert audit trail.
    Prevents duplicate active alerts for the same material and alert type.
    Resolves alerts when conditions clear and allows them to recur.
    """

    def __init__(self, config: Optional[Any] = None):
        self.config = config or settings
        # Maps (materialId, alertType) -> PriceAlert
        self._active_alerts: Dict[str, PriceAlert] = {}
        # Historical log of all alerts (active and resolved)
        self._alert_history: List[PriceAlert] = []
        self._counter: int = 0

    def _next_alert_id(self, material_id: Union[int, str], alert_type: str) -> str:
        self._counter += 1
        return f"ALT-{material_id}-{alert_type}-{self._counter:04d}"

    def process_alerts(
        self,
        results: List[MaterialPriceResult],
        timestamp_str: Optional[str] = None,
    ) -> Tuple[List[PriceAlert], List[PriceAlert], int]:
        """
        Evaluate alert conditions for each material result.
        Updates active alerts, resolves cleared alerts, and logs to history.
        Returns:
            (active_alerts, alert_history, resolved_count)
        """
        now_str = timestamp_str or datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        resolved_count = 0

        # Define alert rules: (alertType, check_fn, severity_fn, threshold_val, message_fn)
        alert_rules = [
            (
                "PRICE_SURGE",
                lambda r: bool(r.isSuddenSurge or r.priceChangePercentage >= self.config.RISK_PRICE_CHANGE_HIGH_THRESHOLD),
                lambda r: "CRITICAL" if r.priceChangePercentage >= 5.0 else "WARNING",
                self.config.RISK_PRICE_CHANGE_HIGH_THRESHOLD,
                lambda r: f"Recent price surge of +{r.priceChangePercentage:.2f}% recorded (threshold: {self.config.RISK_PRICE_CHANGE_HIGH_THRESHOLD:.1f}%).",
                lambda r: r.priceChangePercentage,
            ),
            (
                "HIGH_VOLATILITY",
                lambda r: bool(r.weeklyReturnVolatility >= getattr(self.config, "RISK_RETURN_VOLATILITY_HIGH_THRESHOLD", 2.0)),
                lambda r: "WARNING",
                getattr(self.config, "RISK_RETURN_VOLATILITY_HIGH_THRESHOLD", 2.0),
                lambda r: f"Elevated price volatility: Weekly return volatility is {r.weeklyReturnVolatility:.2f}% (threshold: {getattr(self.config, 'RISK_RETURN_VOLATILITY_HIGH_THRESHOLD', 2.0):.1f}%).",
                lambda r: r.weeklyReturnVolatility,
            ),
            (
                "RAPID_COST_INFLATION",
                lambda r: bool(r.predictedChangePercentage >= self.config.RISK_FORECAST_INCREASE_HIGH_THRESHOLD),
                lambda r: "CRITICAL",
                self.config.RISK_FORECAST_INCREASE_HIGH_THRESHOLD,
                lambda r: f"Projected price increase of +{r.predictedChangePercentage:.2f}% over next {r.predictionHorizonDays} days.",
                lambda r: r.predictedChangePercentage,
            ),
            (
                "STALE_QUOTATION",
                lambda r: bool(r.dataFreshnessDays > self.config.RISK_DATA_STALENESS_DAYS_THRESHOLD),
                lambda r: "INFO",
                float(self.config.RISK_DATA_STALENESS_DAYS_THRESHOLD),
                lambda r: f"Market price observation is {r.dataFreshnessDays} days old (limit: {self.config.RISK_DATA_STALENESS_DAYS_THRESHOLD} days).",
                lambda r: float(r.dataFreshnessDays),
            ),
        ]

        # Track which (materialId, alertType) keys were triggered in this evaluation pass
        triggered_keys = set()

        for res in results:
            for alert_type, condition_fn, severity_fn, threshold, msg_fn, metric_fn in alert_rules:
                key = f"{res.materialId}_{alert_type}"
                is_triggered = condition_fn(res)

                if is_triggered:
                    triggered_keys.add(key)
                    if key in self._active_alerts:
                        # Prevent duplicate active alert; update current metrics and keep active
                        existing = self._active_alerts[key]
                        existing.metricValue = metric_fn(res)
                        existing.timestamp = now_str
                    else:
                        # Create new active alert instance
                        new_alert = PriceAlert(
                            alertId=self._next_alert_id(res.materialId, alert_type),
                            alertType=alert_type,
                            severity=severity_fn(res),
                            materialId=res.materialId,
                            materialName=res.materialName,
                            message=msg_fn(res),
                            metricValue=metric_fn(res),
                            threshold=threshold,
                            status="ACTIVE",
                            timestamp=now_str,
                            resolvedAt=None,
                        )
                        self._active_alerts[key] = new_alert
                        self._alert_history.append(new_alert.model_copy())
                        logger.info(f"Generated new active alert: {new_alert.alertId} ({alert_type}) for material {res.materialName}")

        # Check for previously active alerts that have now cleared (resolved)
        active_keys = list(self._active_alerts.keys())
        for key in active_keys:
            if key not in triggered_keys:
                resolved_alert = self._active_alerts.pop(key)
                resolved_alert.status = "RESOLVED"
                resolved_alert.resolvedAt = now_str
                self._alert_history.append(resolved_alert.model_copy())
                resolved_count += 1
                logger.info(f"Resolved alert: {resolved_alert.alertId} ({resolved_alert.alertType}) for material {resolved_alert.materialName}")

        active_list = list(self._active_alerts.values())
        history_list = list(self._alert_history)
        return active_list, history_list, resolved_count

    def get_active_alerts(self) -> List[PriceAlert]:
        return list(self._active_alerts.values())

    def get_alert_history(self) -> List[PriceAlert]:
        return list(self._alert_history)

    def clear(self) -> None:
        """Reset internal alert state (useful for test isolation)."""
        self._active_alerts.clear()
        self._alert_history.clear()
        self._counter = 0


# Global singleton instance for in-memory alert state
_alert_manager_singleton: Optional[AlertManager] = None


def get_alert_manager() -> AlertManager:
    global _alert_manager_singleton
    if _alert_manager_singleton is None:
        _alert_manager_singleton = AlertManager()
    return _alert_manager_singleton

