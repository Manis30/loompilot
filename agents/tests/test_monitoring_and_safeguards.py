import pytest
from datetime import date
import pandas as pd
from fastapi.testclient import TestClient

from app.core.config import settings
from app.agents.market_price.prediction_engine import PredictionEngine
from app.agents.market_price.alert_manager import AlertManager
from app.schemas.market_price_schema import MaterialPriceResult


def test_consistent_risk_classification_between_analyze_and_monitor(test_client: TestClient):
    """
    Issue 1: Consistent risk classification between /analyze and /monitor.
    Both endpoints must use identical risk thresholds and scoring policy.
    """
    analysis_date = "2026-10-30"
    horizon_days = 15

    # 1. Run /analyze-all
    r_analyze = test_client.post(
        "/api/agents/market-price/analyze-all",
        json={"analysisDate": analysis_date, "predictionHorizonDays": horizon_days},
    )
    assert r_analyze.status_code == 200
    data_analyze = r_analyze.json()

    # 2. Run /monitor with the same analysisDate and horizon
    r_monitor = test_client.post(
        "/api/agents/market-price/monitor",
        json={"analysisDate": analysis_date, "predictionHorizonDays": horizon_days, "lookbackDays": 30},
    )
    assert r_monitor.status_code == 200
    data_monitor = r_monitor.json()

    # Compare summary risk counts
    sum_a = data_analyze["summary"]
    sum_m = data_monitor["summary"]
    assert sum_a["totalMaterialsAnalyzed"] == sum_m["totalMaterialsAnalyzed"]
    assert sum_a["highRiskMaterials"] == sum_m["highRiskMaterials"]
    assert sum_a["mediumRiskMaterials"] == sum_m["mediumRiskMaterials"]
    assert sum_a["lowRiskMaterials"] == sum_m["lowRiskMaterials"]
    assert sum_a["upwardTrendMaterials"] == sum_m["upwardTrendMaterials"]

    # Compare material-level risk classifications and total scores
    analyze_by_id = {m["materialId"]: m for m in data_analyze["results"]}
    monitor_by_id = {m["materialId"]: m for m in data_monitor["results"]}

    for mid, res_a in analyze_by_id.items():
        assert mid in monitor_by_id, f"Material {mid} missing in monitor results"
        res_m = monitor_by_id[mid]
        assert res_a["riskLevel"] == res_m["riskLevel"], f"Risk mismatch for material {mid}: {res_a['riskLevel']} vs {res_m['riskLevel']}"
        assert res_a["riskBreakdown"]["totalRiskScore"] == res_m["riskBreakdown"]["totalRiskScore"]
        assert len(res_a["riskBreakdown"]["contributions"]) == len(res_m["riskBreakdown"]["contributions"])


def test_forecast_horizon_explicit_and_unchanged(test_client: TestClient):
    """
    Issue 2: Forecast horizon calculation.
    User requested horizon must NOT be silently changed.
    All dates, lag days, and effective spans must be explicitly distinguished.
    """
    payload = {
        "materialIds": [1],
        "analysisDate": "2026-10-30",
        "predictionHorizonDays": 15,
    }
    r = test_client.post("/api/agents/market-price/analyze", json=payload)
    assert r.status_code == 200
    data = r.json()
    res = data["results"][0]

    # Verify requested horizon is preserved and NOT overwritten
    assert res["requestedPredictionHorizonDays"] == 15
    assert res["predictionHorizonDays"] == 15
    assert data["requestedPredictionHorizonDays"] == 15
    assert data["predictionHorizonDays"] == 15

    # Verify observation dates and lag days
    assert res["latestObservationDate"] == "2026-10-26"
    assert res["analysisDate"] == "2026-10-30"
    assert res["dataLagDays"] == 4
    assert res["predictionDate"] == "2026-11-14"
    assert res["effectiveForecastHorizonDays"] == 19

    # Verify response-level horizon metadata
    assert data["dataLagDays"] == 4
    assert data["predictionDate"] == "2026-11-14"
    assert data["effectiveForecastHorizonDays"] == 19
    assert "horizonExplanation" in res
    assert "4-day observation lag" in res["horizonExplanation"]
    assert "19 days" in res["horizonExplanation"]


def test_confidence_scoring_r2_safeguard_and_backtesting():
    """
    Issue 3: Forecast confidence scoring.
    A very low R^2 must not automatically receive HIGH confidence.
    Model-fit safeguard must cap confidence and backtesting MAPE must be computed.
    """
    engine = PredictionEngine()

    # Case A: Synthetic dataset with flat price + noisy fluctuations (low R2, e.g. < 0.15)
    # 22 observations with small random noise around 100
    dates = pd.date_range(start="2026-06-01", periods=22, freq="7D")
    # Alternating prices: 100, 100.5, 99.8, 100.2, 100.1...
    noisy_prices = [100.0 + (0.5 if i % 2 == 0 else -0.4) for i in range(22)]
    df_noisy = pd.DataFrame({"ObservationDate": dates, "UnitPriceINR": noisy_prices})

    # Linear regression on this flat series has R^2 close to 0
    res_noisy = engine.predict(df_noisy, horizon_days=15, trend_r_squared=0.04)
    cb_noisy = res_noisy["confidenceBreakdown"]

    # Even though sample size is 22 (score=3), volatility is low (score=2), freshness is high (score=2),
    # R^2 safeguard MUST trigger and cap confidence at MEDIUM (never HIGH)
    assert cb_noisy["r2SafeguardTriggered"] is True
    assert cb_noisy["finalConfidenceLevel"] in ["MEDIUM", "LOW"]
    assert cb_noisy["finalConfidenceLevel"] != "HIGH"
    assert "backtestMape" in cb_noisy
    assert cb_noisy["holdoutObservations"] > 0

    # Case B: High R2 series (strong fit) can achieve HIGH confidence
    res_high = engine.predict(df_noisy, horizon_days=15, trend_r_squared=0.85)
    cb_high = res_high["confidenceBreakdown"]
    assert cb_high["r2SafeguardTriggered"] is False


def test_alert_manager_deduplication_lifecycle_and_history():
    """
    Issue 4: Alert management.
    - Prevents duplicate active alerts for the same material and alert type.
    - Resolves alerts when conditions clear.
    - Allows resolved alerts to recur with new alertId when condition reappears.
    - Preserves full alert history.
    """
    mgr = AlertManager()

    # Base mock result factory
    def make_res(mid=1, name="Cotton Fabric", surge=False, change_pct=0.5, vol=1.4, pred_pct=2.0, staleness=4):
        return MaterialPriceResult(
            materialId=mid,
            materialName=name,
            unit="kg",
            currentPrice=245.0,
            previousPrice=243.0,
            priceChange=2.0,
            priceChangePercentage=change_pct,
            dailyChangePercentage=0.07,
            minHistoricalPrice=180.0,
            maxHistoricalPrice=245.0,
            priceLevelCV=8.9,
            historicalVolatilityCV=8.9,
            weeklyReturnVolatility=vol,
            dailyReturnVolatility=vol / 2.64,
            isSuddenSurge=surge,
            isSuddenDecline=False,
            latestObservationDate="2026-10-26",
            analysisDate="2026-10-30",
            dataLagDays=4,
            requestedPredictionHorizonDays=15,
            effectiveForecastHorizonDays=19,
            predictionHorizonDays=15,
            predictionDate="2026-11-14",
            horizonExplanation="Explanation",
            predictedPrice=251.0,
            predictedChangePercentage=pred_pct,
            riskLevel="MEDIUM",
            confidence="HIGH",
            trend="UPWARD",
            recommendation="Advisory",
            explanation="Explanation",
            totalObservations=22,
            dataFreshnessDays=staleness,
        )

    # --- Cycle 1: Trigger HIGH_VOLATILITY (vol=2.5% >= 2.0% threshold) ---
    res_vol = make_res(mid=1, vol=2.5)
    active, history, resolved = mgr.process_alerts([res_vol], timestamp_str="2026-10-30 10:00:00")
    assert len(active) == 1
    assert active[0].alertType == "HIGH_VOLATILITY"
    assert active[0].status == "ACTIVE"
    first_alert_id = active[0].alertId
    assert len(history) == 1

    # --- Cycle 2: Condition persists; prevent duplicate active alert ---
    active2, history2, resolved2 = mgr.process_alerts([res_vol], timestamp_str="2026-10-30 11:00:00")
    assert len(active2) == 1
    assert active2[0].alertId == first_alert_id  # Same active alert, no duplicate created
    assert len(history2) == 1  # No duplicate history entry

    # --- Cycle 3: Condition clears (vol drops to 1.2% < 2.0%); alert should resolve ---
    res_cleared = make_res(mid=1, vol=1.2)
    active3, history3, resolved3 = mgr.process_alerts([res_cleared], timestamp_str="2026-10-30 12:00:00")
    assert len(active3) == 0  # No active alerts
    assert resolved3 == 1
    assert len(history3) == 2  # Active entry + Resolved entry
    assert history3[-1].status == "RESOLVED"
    assert history3[-1].resolvedAt == "2026-10-30 12:00:00"

    # --- Cycle 4: Condition recurs (vol spikes to 2.8%); new alert generated again ---
    res_spike = make_res(mid=1, vol=2.8)
    active4, history4, resolved4 = mgr.process_alerts([res_spike], timestamp_str="2026-10-30 13:00:00")
    assert len(active4) == 1
    assert active4[0].status == "ACTIVE"
    assert active4[0].alertId != first_alert_id  # New unique alert ID
    assert len(history4) == 3  # Full audit history preserved


def test_volatility_terminology_and_metric_separation(test_client: TestClient):
    """
    Issue 5: Volatility terminology.
    - Clearly distinguishes price-level CV from weekly and daily return volatility.
    - Validates correct statistical descriptors in explanations.
    """
    r = test_client.post(
        "/api/agents/market-price/analyze",
        json={"materialIds": [1], "predictionHorizonDays": 15},
    )
    assert r.status_code == 200
    res = r.json()["results"][0]

    # 1. Distinct metrics present
    assert "priceLevelCV" in res
    assert "weeklyReturnVolatility" in res
    assert "dailyReturnVolatility" in res

    # Price-level CV measures spread (~8.97%), while weekly return volatility measures rate shocks (~1.40%)
    assert res["priceLevelCV"] > res["weeklyReturnVolatility"]

    # 2. Daily return volatility should equal weeklyReturnVolatility / sqrt(7)
    expected_daily = round(res["weeklyReturnVolatility"] / (7.0 ** 0.5), 2)
    assert abs(res["dailyReturnVolatility"] - expected_daily) <= 0.05

    # 3. Explanation does not call CV "annualized volatility"
    explanation = res["explanation"].lower()
    assert "annualized volatility" not in explanation
    assert "price-level dispersion" in explanation
    assert "weekly return volatility" in explanation

