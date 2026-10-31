import pytest
from fastapi.testclient import TestClient


def test_root_endpoint(test_client: TestClient):
    r = test_client.get("/")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "online"
    assert "endpoints" in data


def test_health_endpoint(test_client: TestClient):
    r = test_client.get("/api/agents/market-price/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "healthy"
    assert data["datasetsLoaded"] is True
    assert data["totalMaterials"] == 9
    assert data["totalObservations"] == 198


def test_datasets_endpoint(test_client: TestClient):
    r = test_client.get("/api/agents/market-price/datasets")
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert data["totalDatasetsDiscovered"] >= 15
    assert data["totalMaterialsAvailable"] == 9
    assert data["primaryMarketDataset"] == "LoomPilot_MarketPrices.xlsx"


def test_analyze_endpoint_success(test_client: TestClient):
    payload = {
        "materialIds": [1, "MAT_02", "Buttons"],
        "predictionHorizonDays": 15,
    }
    r = test_client.post("/api/agents/market-price/analyze", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert data["materialsAnalyzed"] == 3
    assert len(data["results"]) == 3
    assert data["results"][0]["materialName"] == "Cotton Fabric"


def test_analyze_endpoint_postman_test_3_enhancements(test_client: TestClient):
    payload = {
        "materialIds": [1, 3, 7],
        "analysisDate": "2026-10-30",
        "predictionHorizonDays": 15,
    }
    r = test_client.post("/api/agents/market-price/analyze", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert data["analysisDate"] == "2026-10-30"
    assert data["predictionHorizonDays"] == 15

    results = {res["materialId"]: res for res in data["results"]}

    # 1. Horizon checks on Material 1 (Cotton Fabric)
    mat1 = results[1]
    assert mat1["latestObservationDate"] == "2026-10-26"
    assert mat1["analysisDate"] == "2026-10-30"
    assert mat1["requestedPredictionHorizonDays"] == 15
    assert mat1["effectiveForecastHorizonDays"] == 19
    assert mat1["predictionDate"] == "2026-11-14"

    # 2. Volatility checks
    assert mat1["priceLevelCV"] > 0
    assert mat1["weeklyReturnVolatility"] > 0
    assert mat1["dailyReturnVolatility"] > 0

    # 3. Confidence breakdown checks (all 10 fields)
    cb = mat1["confidenceBreakdown"]
    required_cb_fields = [
        "observationCount", "MAPE", "R2", "dataFreshnessDays",
        "volatilityScore", "sampleSizeScore", "modelFitScore",
        "freshnessScore", "totalConfidenceScore", "finalConfidenceLevel"
    ]
    for field in required_cb_fields:
        assert field in cb, f"Missing confidence breakdown field: {field}"

    # 4. Risk breakdown checks
    rb = mat1["riskBreakdown"]
    assert "totalRiskScore" in rb
    assert "finalRiskLevel" in rb
    assert "contributions" in rb
    assert len(rb["contributions"]) > 0

    # 5. Risk category distribution (Cotton=MEDIUM, Buttons=HIGH, Linen=LOW)
    assert mat1["riskLevel"] == "MEDIUM"
    assert results[3]["riskLevel"] == "HIGH"
    assert results[7]["riskLevel"] == "LOW"

    # 6. Groq explanation correctness
    exp = mat1["explanation"].lower()
    assert "annualized volatility" not in exp
    assert mat1["recommendation"] != mat1["explanation"]


def test_analyze_endpoint_invalid_material(test_client: TestClient):
    payload = {
        "materialIds": ["CompletelyUnknownMaterial12345"],
        "predictionHorizonDays": 15,
    }
    r = test_client.post("/api/agents/market-price/analyze", json=payload)
    assert r.status_code == 404


def test_analyze_endpoint_validation_error(test_client: TestClient):
    # Empty materialIds list
    payload = {
        "materialIds": [],
        "predictionHorizonDays": 15,
    }
    r = test_client.post("/api/agents/market-price/analyze", json=payload)
    assert r.status_code == 422


def test_analyze_all_endpoint(test_client: TestClient):
    payload = {"predictionHorizonDays": 30}
    r = test_client.post("/api/agents/market-price/analyze-all", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert data["materialsAnalyzed"] == 9


def test_monitor_endpoint(test_client: TestClient):
    payload = {"lookbackDays": 30}
    r = test_client.post("/api/agents/market-price/monitor", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert "alerts" in data
    assert "marketOverview" in data

