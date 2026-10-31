import pytest
import pandas as pd
from app.agents.market_price.prediction_engine import PredictionEngine
from app.data.data_repository import DataRepository


def test_predict_actual_cotton_fabric(real_repository: DataRepository):
    engine = PredictionEngine()
    df = real_repository.get_price_history(1)

    # 15 days forecast
    res_15 = engine.predict(df, horizon_days=15, analysis_date="2026-10-30")
    assert res_15["requestedPredictionHorizonDays"] == 15
    assert res_15["effectiveForecastHorizonDays"] == 19
    assert res_15["latestObservationDate"] == "2026-10-26"
    assert res_15["analysisDate"] == "2026-10-30"
    assert res_15["predictionDate"] == "2026-11-14"
    assert res_15["predictedPrice"] > 245.0
    assert res_15["predictedChangePercentage"] > 0
    assert res_15["confidence"] in ["HIGH", "MEDIUM"]
    assert "confidenceBreakdown" in res_15
    assert res_15["confidenceBreakdown"]["observationCount"] == 22
    assert res_15["lowerConfidenceBound"] < res_15["predictedPrice"] < res_15["upperConfidenceBound"]

    # 7 days forecast
    res_7 = engine.predict(df, horizon_days=7, analysis_date="2026-10-30")
    assert res_7["requestedPredictionHorizonDays"] == 7
    assert res_7["effectiveForecastHorizonDays"] == 11
    assert res_7["predictedPrice"] < res_15["predictedPrice"]

    # 30 days forecast
    res_30 = engine.predict(df, horizon_days=30, analysis_date="2026-10-30")
    assert res_30["requestedPredictionHorizonDays"] == 30
    assert res_30["effectiveForecastHorizonDays"] == 34
    assert res_30["predictedPrice"] > res_15["predictedPrice"]


def test_predict_insufficient_data(synthetic_sparse_history: pd.DataFrame):
    engine = PredictionEngine()
    # 2 observations is below minimum of 4
    res = engine.predict(synthetic_sparse_history, horizon_days=15)

    assert res["confidence"] == "LOW"
    # Fallback holds at latest price
    assert res["predictedPrice"] == 152.0
    assert res["predictedChangePercentage"] == 0.0
    assert len(res["warnings"]) > 0
    assert "insufficient" in res["warnings"][0].lower()


def test_predict_custom_horizon(real_repository: DataRepository):
    engine = PredictionEngine()
    df = real_repository.get_price_history(1)
    res = engine.predict(df, horizon_days=45)
    assert res["predictionHorizonDays"] == 45
    assert res["predictionDate"] is not None


def test_predict_empty_dataframe_raises():
    engine = PredictionEngine()
    with pytest.raises(ValueError):
        engine.predict(pd.DataFrame(), horizon_days=15)

