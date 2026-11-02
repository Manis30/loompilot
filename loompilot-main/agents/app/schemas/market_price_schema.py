from datetime import date
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field


class MaterialPriceAnalysisRequest(BaseModel):
    """Request payload for analyzing specific material prices."""
    materialIds: List[Union[int, str]] = Field(
        ...,
        description="List of material identifiers (numeric ID e.g. 1, code e.g. 'MAT_01', or material name).",
        min_length=1,
    )
    analysisDate: Optional[date] = Field(
        default=None,
        description="Anchor date for analysis. Defaults to the latest available observation date in the dataset."
    )
    predictionHorizonDays: Optional[int] = Field(
        default=15,
        ge=1,
        le=180,
        description="Forecast horizon in days (e.g. 7, 15, 30, or custom)."
    )


class AnalyzeAllRequest(BaseModel):
    """Request payload for analyzing all materials with sufficient historical data."""
    analysisDate: Optional[date] = Field(
        default=None,
        description="Anchor date for analysis. Defaults to latest available observation date."
    )
    predictionHorizonDays: Optional[int] = Field(
        default=15,
        ge=1,
        le=180,
        description="Forecast horizon in days."
    )


class MarketPriceMonitoringRequest(BaseModel):
    """Request payload for periodic market price monitoring."""
    analysisDate: Optional[date] = Field(
        default=None,
        description="Anchor date for monitoring snapshot."
    )
    lookbackDays: Optional[int] = Field(
        default=30,
        ge=7,
        le=365,
        description="Historical lookback window in calendar days to detect recent velocity and anomalies."
    )
    predictionHorizonDays: Optional[int] = Field(
        default=15,
        ge=1,
        le=180,
        description="Forecast horizon in days used for forward risk and inflation analysis (defaults to 15)."
    )


class SupplierInfo(BaseModel):
    """Supplier details linked to material."""
    supplierId: int
    supplierName: str
    city: str
    leadTimeDays: int


class ConfidenceBreakdown(BaseModel):
    """Transparent scoring breakdown supporting the final forecast confidence level."""
    observationCount: int = Field(description="Number of historical observation points available.")
    MAPE: float = Field(description="In-sample Mean Absolute Percentage Error (%).")
    backtestMape: Optional[float] = Field(default=None, description="Out-of-sample holdout validation MAPE (%).")
    R2: float = Field(description="Coefficient of determination (R^2) of historical trend fit.")
    dataFreshnessDays: int = Field(description="Days elapsed between analysis date and latest observation date.")
    volatilityScore: int = Field(description="Score contribution from return-based volatility (0 to 2).")
    sampleSizeScore: int = Field(description="Score contribution from observation sample size (0 to 3).")
    modelFitScore: int = Field(description="Score contribution from MAPE, backtest MAPE, and R2 fit (0 to 3).")
    freshnessScore: int = Field(description="Score contribution from data freshness (0 to 2).")
    totalConfidenceScore: int = Field(description="Sum of all confidence scores (0 to 10).")
    r2SafeguardTriggered: bool = Field(default=False, description="Flag indicating if low R2 safeguard capped confidence.")
    holdoutObservations: int = Field(default=0, description="Number of holdout periods used for out-of-sample backtesting.")
    finalConfidenceLevel: str = Field(description="Final confidence classification: HIGH, MEDIUM, or LOW.")


class RiskFactorContribution(BaseModel):
    """Individual evidence contributing to the overall commodity risk classification."""
    category: str = Field(description="Risk category (Return Volatility, Forecasted Inflation, etc.).")
    score: int = Field(description="Numerical point contribution to overall risk score.")
    metric: str = Field(description="Specific underlying metric value triggering this risk.")
    description: str = Field(description="Human-readable explanation of risk contribution.")


class RiskBreakdown(BaseModel):
    """Detailed risk scoring matrix providing complete transparency into risk assignment."""
    totalRiskScore: int = Field(description="Sum of risk contribution scores.")
    finalRiskLevel: str = Field(description="Final risk classification: LOW, MEDIUM, or HIGH.")
    contributions: List[RiskFactorContribution] = Field(default_factory=list)


class MaterialPriceResult(BaseModel):
    """Comprehensive analytical and predictive evaluation for a single material."""
    materialId: Union[int, str]
    materialName: str
    unit: str
    currency: str = "INR"

    # Historical metrics
    currentPrice: float
    previousPrice: float
    priceChange: float
    priceChangePercentage: float
    dailyChangePercentage: float
    sevenDayAveragePrice: Optional[float] = None
    thirtyDayAveragePrice: Optional[float] = None
    minHistoricalPrice: float
    maxHistoricalPrice: float
    priceLevelCV: float = Field(description="Price-level Coefficient of Variation (%) measuring long-term dispersion.")
    historicalVolatilityCV: float = Field(description="Backward-compatible alias for priceLevelCV.")
    weeklyReturnVolatility: float = Field(description="Sample standard deviation of historical weekly percentage returns (%).")
    dailyReturnVolatility: float = Field(description="Daily equivalent return volatility (%).")
    isSuddenSurge: bool = Field(default=False, description="Whether the latest observation is a statistically anomalous upward jump.")
    isSuddenDecline: bool = Field(default=False, description="Whether the latest observation is a statistically anomalous downward drop.")

    # Horizon & Date details
    latestObservationDate: str = Field(description="Date of the most recent actual observation in the dataset.")
    analysisDate: str = Field(description="Anchor date from which requested horizon is measured.")
    dataLagDays: int = Field(default=0, description="Days elapsed between latestObservationDate and analysisDate.")
    requestedPredictionHorizonDays: int = Field(description="Requested forecasting horizon in days after analysisDate.")
    effectiveForecastHorizonDays: int = Field(description="Actual forecasting span from latestObservationDate to predictionDate.")
    predictionHorizonDays: int = Field(description="Alias for requestedPredictionHorizonDays.")
    predictionDate: str = Field(description="Target future date for which price is projected.")
    horizonExplanation: str = Field(default="", description="Explicit clarification of requested vs effective forecast horizon.")

    # Future prediction
    predictedPrice: float
    predictedChangePercentage: float
    lowerConfidenceBound: Optional[float] = None
    upperConfidenceBound: Optional[float] = None

    # Risk & Trend
    riskLevel: str = Field(description="Risk classification: LOW, MEDIUM, or HIGH.")
    riskBreakdown: Optional[RiskBreakdown] = None
    confidence: str = Field(description="Forecast confidence: LOW, MEDIUM, or HIGH.")
    confidenceBreakdown: Optional[ConfidenceBreakdown] = None
    trend: str = Field(description="Detected trend: UPWARD, DOWNWARD, or STABLE.")

    # Business Intelligence
    recommendation: str
    riskFactors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    supplierInfo: Optional[SupplierInfo] = None

    # AI Reasoning
    explanation: str

    # Observation metadata
    totalObservations: int
    dataFreshnessDays: int


class PriceAlert(BaseModel):
    """Alert triggered during market monitoring."""
    alertId: Optional[str] = Field(default=None, description="Unique identifier for the alert instance.")
    alertType: str = Field(description="E.g., PRICE_SURGE, HIGH_VOLATILITY, RAPID_COST_INFLATION, STALE_QUOTATION")
    severity: str = Field(description="INFO, WARNING, CRITICAL")
    materialId: Union[int, str]
    materialName: str
    message: str
    metricValue: float
    threshold: Optional[float] = Field(default=None, description="Configured threshold value that triggered the alert.")
    status: str = Field(default="ACTIVE", description="Alert state: ACTIVE or RESOLVED.")
    timestamp: str
    resolvedAt: Optional[str] = Field(default=None, description="Timestamp when alert condition resolved.")


class MarketSummary(BaseModel):
    """Consolidated market status summary."""
    totalMaterialsAnalyzed: int
    highRiskMaterials: int
    mediumRiskMaterials: int
    lowRiskMaterials: int
    upwardTrendMaterials: int
    downwardTrendMaterials: int
    stableTrendMaterials: int
    executiveExplanation: Optional[str] = None


class MaterialPriceAnalysisResponse(BaseModel):
    """Structured response for material price analysis."""
    success: bool = True
    agent: str = "market_price_agent"
    analysisDate: str
    latestObservationDate: Optional[str] = None
    dataLagDays: Optional[int] = None
    requestedPredictionHorizonDays: int = Field(default=15)
    effectiveForecastHorizonDays: Optional[int] = None
    predictionHorizonDays: int = Field(default=15)
    predictionDate: Optional[str] = None
    horizonExplanation: Optional[str] = None
    materialsAnalyzed: int
    results: List[MaterialPriceResult]
    summary: Dict[str, Any]
    warnings: List[str] = Field(default_factory=list)


class MarketPriceMonitoringResponse(BaseModel):
    """Structured response for periodic market monitoring."""
    success: bool = True
    agent: str = "market_price_agent"
    analysisDate: str
    lookbackDays: int
    predictionHorizonDays: int = Field(default=15, description="Forecasting horizon used for risk analysis.")
    alertsGenerated: int
    resolvedAlertsCount: int = Field(default=0, description="Count of alerts resolved in this cycle.")
    alerts: List[PriceAlert]
    alertHistory: Optional[List[PriceAlert]] = Field(default_factory=list, description="Historical audit log of all alerts.")
    results: List[MaterialPriceResult]
    summary: Dict[str, Any]
    marketOverview: Optional[str] = None


class DatasetSheetInfo(BaseModel):
    sheetName: str
    rowCount: int
    columnCount: int
    columns: List[str]


class DatasetFileMetadata(BaseModel):
    filename: str
    sheets: List[DatasetSheetInfo]
    isRelevantToAgent: bool
    description: str


class DatasetInfoResponse(BaseModel):
    """Metadata response describing all discovered Excel datasets."""
    success: bool = True
    datasetDirectory: str
    totalDatasetsDiscovered: int
    primaryMarketDataset: str
    datasets: List[DatasetFileMetadata]
    totalMaterialsAvailable: int
    totalObservations: int
    dateRange: Dict[str, str]
    dataQualitySummary: Dict[str, Any]


class HealthCheckResponse(BaseModel):
    """Health check response for the Market Price Agent."""
    status: str = "healthy"
    agent: str = "market_price_agent"
    version: str = "1.0.0"
    datasetsLoaded: bool
    datasetPath: str
    totalMaterials: int
    totalObservations: int
    groqConfigured: bool
    groqConnected: bool
    groqModel: str
