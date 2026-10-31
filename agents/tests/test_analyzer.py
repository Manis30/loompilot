import pytest
import pandas as pd
from app.agents.market_price.analyzer import PriceAnalyzer
from app.data.data_repository import DataRepository


def test_analyzer_actual_material_1(real_repository: DataRepository):
    analyzer = PriceAnalyzer()
    df = real_repository.get_price_history(1)
    res = analyzer.analyze_history(df)

    assert res["latestPrice"] == 245.16
    assert res["previousPrice"] == 244.05
    assert res["priceChange"] == 1.11
    assert res["totalObservations"] == 22
    assert res["minHistoricalPrice"] == 182.00
    assert res["maxHistoricalPrice"] == 245.16
    assert res["trend"] == "UPWARD"
    # Price level dispersion CV
    assert res["priceLevelCV"] > 7.0
    assert res["historicalVolatilityCV"] == res["priceLevelCV"]
    # Return volatility
    assert res["weeklyReturnVolatility"] > 0.0
    assert res["dailyReturnVolatility"] > 0.0
    assert res["dailyReturnVolatility"] < res["weeklyReturnVolatility"]
    assert res["sevenDayAveragePrice"] is not None
    assert res["thirtyDayAveragePrice"] is not None


def test_analyzer_actual_material_7_stable(real_repository: DataRepository):
    analyzer = PriceAnalyzer()
    df = real_repository.get_price_history(7)
    res = analyzer.analyze_history(df)

    assert res["latestPrice"] == 241.41
    # Linen has low price-level dispersion ~1.1% and low return volatility
    assert res["priceLevelCV"] < 2.0
    assert res["weeklyReturnVolatility"] < 1.0
    assert res["unverifiedObservations"] == 6


def test_analyzer_trend_detection_synthetic(synthetic_upward_history: pd.DataFrame, synthetic_flat_history: pd.DataFrame):
    analyzer = PriceAnalyzer()

    upward_res = analyzer.analyze_history(synthetic_upward_history)
    assert upward_res["trend"] == "UPWARD"
    assert upward_res["trendSlope"] > 0

    flat_res = analyzer.analyze_history(synthetic_flat_history)
    assert flat_res["trend"] == "STABLE"


def test_analyzer_sudden_surge_detection():
    analyzer = PriceAnalyzer()
    # 5 flat observations followed by huge 15% spike
    df = pd.DataFrame([
        {"ObservationDate": f"2026-06-0{i+1}", "UnitPriceINR": 100.0, "VerificationStatus": "Verified"}
        for i in range(5)
    ] + [
        {"ObservationDate": "2026-06-06", "UnitPriceINR": 118.0, "VerificationStatus": "Verified"}
    ])
    res = analyzer.analyze_history(df)
    assert res["isSuddenSurge"] is True
    assert res["unusualFluctuations"] is True


def test_analyzer_empty_dataframe_raises():
    analyzer = PriceAnalyzer()
    with pytest.raises(ValueError):
        analyzer.analyze_history(pd.DataFrame())

