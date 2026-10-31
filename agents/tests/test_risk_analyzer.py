import pytest
from app.agents.market_price.risk_analyzer import RiskAnalyzer


def test_evaluate_risk_high():
    analyzer = RiskAnalyzer()
    analysis_data = {
        "priceLevelCV": 8.5,
        "weeklyReturnVolatility": 2.8,
        "dailyChangePercentage": 0.5,
        "isSuddenSurge": True,
        "trend": "UPWARD",
        "totalObservations": 20,
    }
    prediction_data = {
        "predictedChangePercentage": 4.5,
        "dataFreshnessDays": 3,
        "predictionHorizonDays": 15,
    }

    risk_level, factors, breakdown = analyzer.evaluate_risk(analysis_data, prediction_data)
    assert risk_level == "HIGH"
    assert len(factors) >= 2
    assert any("volatility" in f.lower() for f in factors)
    assert any("surge" in f.lower() for f in factors)
    assert breakdown["finalRiskLevel"] == "HIGH"
    assert len(breakdown["contributions"]) >= 2
    assert breakdown["totalRiskScore"] >= 4.0


def test_evaluate_risk_low():
    analyzer = RiskAnalyzer()
    analysis_data = {
        "priceLevelCV": 1.2,
        "weeklyReturnVolatility": 0.4,
        "dailyChangePercentage": 0.01,
        "isSuddenSurge": False,
        "isSuddenDecline": False,
        "trend": "STABLE",
        "totalObservations": 22,
        "unverifiedObservations": 0,
    }
    prediction_data = {
        "predictedChangePercentage": 0.3,
        "dataFreshnessDays": 4,
        "predictionHorizonDays": 15,
    }

    risk_level, factors, breakdown = analyzer.evaluate_risk(analysis_data, prediction_data)
    assert risk_level == "LOW"
    assert breakdown["finalRiskLevel"] == "LOW"
    assert breakdown["totalRiskScore"] < 2.0


def test_evaluate_risk_unverified_records_flag():
    analyzer = RiskAnalyzer()
    analysis_data = {
        "priceLevelCV": 2.0,
        "weeklyReturnVolatility": 0.8,
        "trend": "STABLE",
        "totalObservations": 22,
        "unverifiedObservations": 6,
    }
    prediction_data = {
        "predictedChangePercentage": 0.5,
        "dataFreshnessDays": 4,
        "predictionHorizonDays": 15,
    }

    risk_level, factors, breakdown = analyzer.evaluate_risk(analysis_data, prediction_data)
    assert any("unverified" in f.lower() for f in factors)
    assert any(c["category"] == "Data Verification" for c in breakdown["contributions"])


