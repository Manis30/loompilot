import os
from pathlib import Path
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration settings loaded from environment or .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Project metadata
    PROJECT_NAME: str = "LoomPilot Market Price Agent"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api/agents/market-price"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    # Server configuration
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Dataset path (relative to project root or absolute)
    DATASET_DIR: str = "LoomPilot Datasets"

    # Groq LLM configuration
    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    GROQ_TIMEOUT_SECONDS: float = 15.0

    # Risk analysis thresholds (configurable)
    RISK_VOLATILITY_LOW_THRESHOLD: float = 3.0       # Price-level CV % below this is low dispersion
    RISK_VOLATILITY_HIGH_THRESHOLD: float = 7.0      # Price-level CV % above this is high dispersion
    RISK_RETURN_VOLATILITY_LOW_THRESHOLD: float = 1.0  # Weekly return vol % below this is LOW risk
    RISK_RETURN_VOLATILITY_HIGH_THRESHOLD: float = 2.0 # Weekly return vol % above this is HIGH risk
    RISK_PRICE_CHANGE_HIGH_THRESHOLD: float = 3.0     # Step change % above this raises risk / triggers PRICE_SURGE
    RISK_FORECAST_INCREASE_HIGH_THRESHOLD: float = 4.0 # Projected increase % above this is HIGH risk / triggers RAPID_COST_INFLATION
    RISK_FORECAST_INCREASE_MED_THRESHOLD: float = 2.0  # Projected increase % above this is MEDIUM risk
    RISK_DATA_STALENESS_DAYS_THRESHOLD: int = 14     # Days beyond which data is considered stale / triggers STALE_QUOTATION
    MIN_OBSERVATIONS_FOR_PREDICTION: int = 4         # Minimum observation points required for time series model
    MIN_R2_FOR_HIGH_CONFIDENCE: float = 0.35         # Model-fit safeguard: minimum R2 required to grant HIGH confidence
    HOLDOUT_BACKTEST_PERIODS: int = 4                # Number of historical observations for holdout backtesting

    # CORS
    ALLOWED_ORIGINS: List[str] = ["*"]

    @property
    def dataset_path(self) -> Path:
        """Resolve dataset directory to absolute Path."""
        path = Path(self.DATASET_DIR)
        if not path.is_absolute():
            # Resolve relative to project root
            base_dir = Path(__file__).resolve().parent.parent.parent
            path = (base_dir / self.DATASET_DIR).resolve()
        return path


settings = Settings()

