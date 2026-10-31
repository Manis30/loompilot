import os
import sys
from datetime import datetime, timedelta
from typing import Generator
import pandas as pd
import pytest
from fastapi.testclient import TestClient

# Ensure project root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ["DISABLE_GROQ"] = "true"

from app.core.config import settings
from app.data.excel_loader import ExcelDataLoader
from app.data.data_repository import DataRepository
from app.agents.market_price.agent import MarketPriceAgent
from app.agents.market_price.analyzer import PriceAnalyzer
from app.agents.market_price.prediction_engine import PredictionEngine
from app.agents.market_price.risk_analyzer import RiskAnalyzer
from app.agents.market_price.recommendation_engine import RecommendationEngine
from app.agents.market_price.explanation_service import ExplanationService
from app.llm.groq_client import GroqClient
from app.main import app


@pytest.fixture(scope="session")
def real_repository() -> DataRepository:
    """Fixture providing initialized DataRepository with actual LoomPilot datasets."""
    repo = DataRepository()
    repo.load()
    return repo


@pytest.fixture(scope="session")
def real_agent(real_repository: DataRepository) -> MarketPriceAgent:
    """Fixture providing fully wired MarketPriceAgent with actual datasets."""
    return MarketPriceAgent(repository=real_repository)


@pytest.fixture
def test_client() -> Generator[TestClient, None, None]:
    """TestClient fixture for testing FastAPI endpoints."""
    with TestClient(app) as client:
        yield client


@pytest.fixture
def synthetic_upward_history() -> pd.DataFrame:
    """Synthetic price history with upward trend (20 weekly observations)."""
    start_date = datetime(2026, 1, 5)
    rows = []
    base_price = 100.0
    for i in range(20):
        obs_date = start_date + timedelta(days=i * 7)
        price = base_price + i * 2.5 + (0.5 if i % 2 == 0 else -0.5)
        rows.append({
            "PriceObservationID": i + 1,
            "MaterialID": 99,
            "ObservationDate": obs_date,
            "UnitPriceINR": price,
            "PriceSource": "Synthetic Test Feed",
            "VerificationStatus": "Verified",
        })
    return pd.DataFrame(rows)


@pytest.fixture
def synthetic_flat_history() -> pd.DataFrame:
    """Synthetic price history with stable/flat prices (20 weekly observations)."""
    start_date = datetime(2026, 1, 5)
    rows = []
    base_price = 50.0
    for i in range(20):
        obs_date = start_date + timedelta(days=i * 7)
        price = base_price + (0.1 if i % 2 == 0 else -0.1)
        rows.append({
            "PriceObservationID": i + 1,
            "MaterialID": 98,
            "ObservationDate": obs_date,
            "UnitPriceINR": price,
            "PriceSource": "Synthetic Test Feed",
            "VerificationStatus": "Verified",
        })
    return pd.DataFrame(rows)


@pytest.fixture
def synthetic_sparse_history() -> pd.DataFrame:
    """Synthetic history with only 2 observations (insufficient data test)."""
    return pd.DataFrame([
        {
            "PriceObservationID": 1,
            "MaterialID": 97,
            "ObservationDate": datetime(2026, 10, 1),
            "UnitPriceINR": 150.0,
            "PriceSource": "Synthetic Test Feed",
            "VerificationStatus": "Verified",
        },
        {
            "PriceObservationID": 2,
            "MaterialID": 97,
            "ObservationDate": datetime(2026, 10, 8),
            "UnitPriceINR": 152.0,
            "PriceSource": "Synthetic Test Feed",
            "VerificationStatus": "Verified",
        },
    ])

