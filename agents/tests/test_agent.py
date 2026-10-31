import pytest
from app.agents.market_price.agent import MarketPriceAgent


def test_agent_analyze_single_material(real_agent: MarketPriceAgent):
    # Test with explicit analysis_date
    res = real_agent.analyze_single_material(1, prediction_horizon_days=15, analysis_date="2026-10-30")
    assert res.materialId == 1
    assert res.materialName == "Cotton Fabric"
    assert res.currentPrice == 245.16
    assert res.predictedPrice > 245.0
    # Under improved return-based volatility, Cotton is MEDIUM risk (weekly return vol ~1.40%)
    assert res.riskLevel == "MEDIUM"
    assert res.supplierInfo is not None
    assert res.supplierInfo.supplierName == "South Loom Supplies"
    assert res.latestObservationDate == "2026-10-26"
    assert res.analysisDate == "2026-10-30"
    assert res.requestedPredictionHorizonDays == 15
    assert res.effectiveForecastHorizonDays == 19
    assert res.predictionDate == "2026-11-14"
    assert res.weeklyReturnVolatility is not None
    assert res.priceLevelCV is not None
    assert res.confidenceBreakdown is not None
    assert res.confidenceBreakdown.finalConfidenceLevel in ["HIGH", "MEDIUM"]
    assert res.riskBreakdown is not None
    assert len(res.riskBreakdown.contributions) > 0
    assert len(res.explanation) > 20

    # Also test default analysis_date (defaults to latest observation date 2026-10-26)
    res_default = real_agent.analyze_single_material(1, prediction_horizon_days=15)
    assert res_default.latestObservationDate == "2026-10-26"
    assert res_default.analysisDate == "2026-10-26"
    assert res_default.requestedPredictionHorizonDays == 15
    assert res_default.effectiveForecastHorizonDays == 15
    assert res_default.predictionDate == "2026-11-10"


def test_agent_analyze_multiple_materials(real_agent: MarketPriceAgent):
    # Materials [1, 3, 7] test all three risk tiers:
    # 1: Cotton (MEDIUM risk)
    # 3: Buttons (HIGH risk due to return volatility and step surge)
    # 7: Linen (LOW risk)
    response = real_agent.analyze_materials([1, 3, 7], prediction_horizon_days=15)
    assert response.success is True
    assert response.materialsAnalyzed == 3
    assert len(response.results) == 3
    assert response.summary["totalMaterialsAnalyzed"] == 3
    assert response.summary["highRiskMaterials"] >= 1
    assert response.summary["mediumRiskMaterials"] >= 1
    assert response.summary["lowRiskMaterials"] >= 1



def test_agent_analyze_all_materials(real_agent: MarketPriceAgent):
    response = real_agent.analyze_all_materials(prediction_horizon_days=15)
    assert response.success is True
    assert response.materialsAnalyzed == 9
    assert len(response.results) == 9
    assert response.summary["totalMaterialsAnalyzed"] == 9


def test_agent_monitor_market(real_agent: MarketPriceAgent):
    response = real_agent.monitor_market(lookback_days=30)
    assert response.success is True
    assert response.alertsGenerated > 0
    assert len(response.results) == 9
    assert response.marketOverview is not None
    assert len(response.marketOverview) > 20

