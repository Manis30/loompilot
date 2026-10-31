import pytest
from app.llm.groq_client import GroqClient
from app.agents.market_price.explanation_service import ExplanationService


def test_groq_client_unconfigured_initialization():
    client = GroqClient(api_key="")
    assert not client.is_configured
    # generate_completion should return None safely
    assert client.generate_completion("sys", "user") is None
    health = client.check_health()
    assert health["configured"] is False
    assert health["connected"] is False


def test_groq_client_invalid_key_fallback():
    # Pass an explicitly invalid key to test exception interception
    client = GroqClient(api_key="gsk_invalid_test_key_1234567890")
    assert client.is_configured
    # Calling generate_completion should safely catch exception and return None
    result = client.generate_completion("sys", "user")
    assert result is None


def test_explanation_service_deterministic_fallback():
    # Force client to unconfigured to test fallback
    service = ExplanationService(groq_client=GroqClient(api_key=None))
    data = {
        "materialName": "Cotton Fabric",
        "unit": "kg",
        "currentPrice": 245.16,
        "previousPrice": 244.05,
        "priceChangePercentage": 0.45,
        "trend": "UPWARD",
        "historicalVolatilityCV": 8.77,
        "predictedPrice": 251.59,
        "predictedChangePercentage": 2.62,
        "predictionHorizonDays": 15,
        "predictionDate": "2026-11-14",
        "riskLevel": "HIGH",
        "confidence": "HIGH",
        "recommendation": "Lock orders earlier with supplier.",
    }

    explanation = service.explain_material_analysis(data)
    assert isinstance(explanation, str)
    assert "Cotton Fabric" in explanation
    assert "245.16" in explanation
    assert "251.59" in explanation
    assert "HIGH" in explanation
