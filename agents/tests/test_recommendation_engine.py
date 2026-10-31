import pytest
from app.agents.market_price.recommendation_engine import RecommendationEngine


def test_recommendation_high_risk_upward():
    engine = RecommendationEngine()
    supplier = {"SupplierName": "South Loom Supplies", "LeadTimeDays": 4}
    rec = engine.generate_recommendation(
        material_name="Cotton Fabric",
        current_price=245.0,
        predicted_price=252.0,
        predicted_change_pct=2.85,
        trend="UPWARD",
        risk_level="HIGH",
        confidence="HIGH",
        volatility_cv=8.5,
        supplier_info=supplier,
        unit="kg",
    )
    assert "earlier" in rec.lower()
    assert "South Loom Supplies" in rec
    assert "4 days" in rec


def test_recommendation_downward_trend():
    engine = RecommendationEngine()
    rec = engine.generate_recommendation(
        material_name="Linen Fabric",
        current_price=241.0,
        predicted_price=237.0,
        predicted_change_pct=-1.65,
        trend="DOWNWARD",
        risk_level="LOW",
        confidence="HIGH",
        volatility_cv=1.1,
    )
    assert "wait" in rec.lower() or "monitor" in rec.lower()
    assert "declining" in rec.lower()


def test_recommendation_low_confidence():
    engine = RecommendationEngine()
    rec = engine.generate_recommendation(
        material_name="New Material",
        current_price=100.0,
        predicted_price=105.0,
        predicted_change_pct=5.0,
        trend="UPWARD",
        risk_level="MEDIUM",
        confidence="LOW",
        volatility_cv=4.0,
    )
    assert "uncertainty" in rec.lower()
    assert "quotation" in rec.lower()

