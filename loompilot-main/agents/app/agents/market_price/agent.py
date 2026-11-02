from datetime import date, datetime
from typing import Any, Dict, List, Optional, Union

from app.core.config import settings
from app.core.logging import get_logger
from app.data.data_repository import DataRepository, get_data_repository
from app.agents.market_price.analyzer import PriceAnalyzer
from app.agents.market_price.prediction_engine import PredictionEngine
from app.agents.market_price.risk_analyzer import RiskAnalyzer
from app.agents.market_price.recommendation_engine import RecommendationEngine
from app.agents.market_price.explanation_service import ExplanationService
from app.agents.market_price.alert_manager import AlertManager, get_alert_manager
from app.schemas.market_price_schema import (
    MaterialPriceResult,
    MaterialPriceAnalysisResponse,
    MarketPriceMonitoringResponse,
    PriceAlert,
    SupplierInfo,
    ConfidenceBreakdown,
    RiskBreakdown,
)

logger = get_logger(__name__)


class MarketPriceAgent:
    """
    Core Market Price Agent for LoomPilot textile manufacturing platform.
    Orchestrates historical price analysis, forecasting, risk classification,
    purchasing recommendations, and Groq-driven business explanations.
    """

    def __init__(
        self,
        repository: Optional[DataRepository] = None,
        analyzer: Optional[PriceAnalyzer] = None,
        prediction_engine: Optional[PredictionEngine] = None,
        risk_analyzer: Optional[RiskAnalyzer] = None,
        recommendation_engine: Optional[RecommendationEngine] = None,
        explanation_service: Optional[ExplanationService] = None,
        alert_manager: Optional[AlertManager] = None,
    ):
        self.repository = repository or get_data_repository()
        self.analyzer = analyzer or PriceAnalyzer()
        self.prediction_engine = prediction_engine or PredictionEngine()
        self.risk_analyzer = risk_analyzer or RiskAnalyzer()
        self.recommendation_engine = recommendation_engine or RecommendationEngine()
        self.explanation_service = explanation_service or ExplanationService()
        self.alert_manager = alert_manager or get_alert_manager()

    def analyze_single_material(
        self,
        identifier: Union[int, str],
        analysis_date: Optional[Union[date, datetime, str]] = None,
        prediction_horizon_days: int = 15,
    ) -> MaterialPriceResult:
        """
        Execute full analytical pipeline on a single raw material.
        """
        # 1. Retrieve material catalog metadata
        mat_meta = self.repository.get_material(identifier)
        mat_id = mat_meta["MaterialID"]
        mat_name = mat_meta["MaterialName"]
        unit = mat_meta.get("Unit", "unit")
        stock = mat_meta.get("CurrentStock")

        # 2. Retrieve supplier details if available
        supplier_dict = mat_meta.get("supplier")
        supplier_info = (
            SupplierInfo(
                supplierId=int(supplier_dict.get("SupplierID") or supplier_dict.get("supplierId", 0)),
                supplierName=str(supplier_dict.get("SupplierName") or supplier_dict.get("supplierName", "")),
                city=str(supplier_dict.get("City") or supplier_dict.get("city", "")),
                leadTimeDays=int(supplier_dict.get("LeadTimeDays") or supplier_dict.get("leadTimeDays", 0)),
            )
            if supplier_dict
            else None
        )

        # 3. Retrieve chronological price history
        history_df = self.repository.get_price_history(identifier, as_of_date=analysis_date)
        if history_df.empty:
            raise ValueError(f"No price history found for material '{identifier}' as of {analysis_date}.")

        # 4. Statistical Analysis (Price levels, CV, Return-based Volatility, Trend)
        analysis = self.analyzer.analyze_history(history_df)

        # 5. Price Forecasting (Explicit Effective Horizon Handling)
        forecast = self.prediction_engine.predict(
            history_df=history_df,
            horizon_days=prediction_horizon_days,
            analysis_date=analysis_date,
            trend_r_squared=analysis.get("trendRSquared", 0.0),
            weekly_return_volatility=analysis.get("weeklyReturnVolatility"),
        )

        # 6. Risk Analysis (Reevaluated using return-based volatility)
        risk_level, risk_factors, risk_breakdown = self.risk_analyzer.evaluate_risk(analysis, forecast)

        # 7. Purchasing Recommendation
        recommendation = self.recommendation_engine.generate_recommendation(
            material_name=mat_name,
            current_price=analysis["latestPrice"],
            predicted_price=forecast["predictedPrice"],
            predicted_change_pct=forecast["predictedChangePercentage"],
            trend=analysis["trend"],
            risk_level=risk_level,
            confidence=forecast["confidence"],
            volatility_cv=analysis["weeklyReturnVolatility"],
            is_surge=analysis["isSuddenSurge"],
            is_decline=analysis["isSuddenDecline"],
            supplier_info=supplier_dict,
            current_stock=stock,
            unit=unit,
        )

        # 8. Build context for AI explanation
        confidence_breakdown_dict = forecast.get("confidenceBreakdown", {})
        explanation_payload = {
            "materialId": mat_id,
            "materialName": mat_name,
            "unit": unit,
            "currency": "INR",
            "currentStock": stock,
            "supplierInfo": supplier_dict,
            "currentPrice": analysis["latestPrice"],
            "previousPrice": analysis["previousPrice"],
            "priceChange": analysis["priceChange"],
            "priceChangePercentage": analysis["priceChangePercentage"],
            "dailyChangePercentage": analysis["dailyChangePercentage"],
            "sevenDayAveragePrice": analysis["sevenDayAveragePrice"],
            "thirtyDayAveragePrice": analysis["thirtyDayAveragePrice"],
            "monthlyPriceMovement": analysis["monthlyPriceMovement"],
            "minHistoricalPrice": analysis["minHistoricalPrice"],
            "maxHistoricalPrice": analysis["maxHistoricalPrice"],
            "priceLevelCV": analysis["priceLevelCV"],
            "historicalVolatilityCV": analysis["historicalVolatilityCV"],
            "weeklyReturnVolatility": analysis["weeklyReturnVolatility"],
            "dailyReturnVolatility": analysis["dailyReturnVolatility"],
            "trend": analysis["trend"],
            "totalObservations": analysis["totalObservations"],
            "latestObservationDate": forecast["latestObservationDate"],
            "analysisDate": forecast["analysisDate"],
            "requestedPredictionHorizonDays": forecast["requestedPredictionHorizonDays"],
            "effectiveForecastHorizonDays": forecast["effectiveForecastHorizonDays"],
            "predictedPrice": forecast["predictedPrice"],
            "predictedChangePercentage": forecast["predictedChangePercentage"],
            "predictionDate": forecast["predictionDate"],
            "predictionHorizonDays": forecast["predictionHorizonDays"],
            "lowerConfidenceBound": forecast["lowerConfidenceBound"],
            "upperConfidenceBound": forecast["upperConfidenceBound"],
            "confidence": forecast["confidence"],
            "confidenceBreakdown": confidence_breakdown_dict,
            "riskLevel": risk_level,
            "riskFactors": risk_factors,
            "riskBreakdown": risk_breakdown,
            "recommendation": recommendation,
            "warnings": forecast["warnings"],
        }

        # 9. Natural Language AI Explanation
        explanation = self.explanation_service.explain_material_analysis(explanation_payload)

        # 10. Assemble structured result
        confidence_obj = (
            ConfidenceBreakdown(**confidence_breakdown_dict)
            if confidence_breakdown_dict
            else None
        )
        risk_breakdown_obj = (
            RiskBreakdown(**risk_breakdown)
            if risk_breakdown
            else None
        )

        return MaterialPriceResult(
            materialId=mat_id,
            materialName=mat_name,
            unit=unit,
            currency="INR",
            currentPrice=analysis["latestPrice"],
            previousPrice=analysis["previousPrice"],
            priceChange=analysis["priceChange"],
            priceChangePercentage=analysis["priceChangePercentage"],
            dailyChangePercentage=analysis["dailyChangePercentage"],
            sevenDayAveragePrice=analysis["sevenDayAveragePrice"],
            thirtyDayAveragePrice=analysis["thirtyDayAveragePrice"],
            minHistoricalPrice=analysis["minHistoricalPrice"],
            maxHistoricalPrice=analysis["maxHistoricalPrice"],
            priceLevelCV=analysis["priceLevelCV"],
            historicalVolatilityCV=analysis["historicalVolatilityCV"],
            weeklyReturnVolatility=analysis["weeklyReturnVolatility"],
            dailyReturnVolatility=analysis["dailyReturnVolatility"],
            isSuddenSurge=analysis.get("isSuddenSurge", False),
            isSuddenDecline=analysis.get("isSuddenDecline", False),
            latestObservationDate=forecast["latestObservationDate"],
            analysisDate=forecast["analysisDate"],
            dataLagDays=forecast.get("dataLagDays", 0),
            requestedPredictionHorizonDays=forecast["requestedPredictionHorizonDays"],
            effectiveForecastHorizonDays=forecast["effectiveForecastHorizonDays"],
            predictionHorizonDays=forecast["predictionHorizonDays"],
            predictionDate=forecast["predictionDate"],
            horizonExplanation=forecast.get("horizonExplanation", ""),
            predictedPrice=forecast["predictedPrice"],
            predictedChangePercentage=forecast["predictedChangePercentage"],
            lowerConfidenceBound=forecast["lowerConfidenceBound"],
            upperConfidenceBound=forecast["upperConfidenceBound"],
            riskLevel=risk_level,
            riskBreakdown=risk_breakdown_obj,
            confidence=forecast["confidence"],
            confidenceBreakdown=confidence_obj,
            trend=analysis["trend"],
            recommendation=recommendation,
            riskFactors=risk_factors,
            warnings=forecast["warnings"],
            supplierInfo=supplier_info,
            explanation=explanation,
            totalObservations=analysis["totalObservations"],
            dataFreshnessDays=forecast["dataFreshnessDays"],
        )

    def analyze_materials(
        self,
        material_ids: List[Union[int, str]],
        analysis_date: Optional[Union[date, datetime, str]] = None,
        prediction_horizon_days: int = 15,
    ) -> MaterialPriceAnalysisResponse:
        """
        Scenario A: Multi-material price analysis for new manufacturing order planning.
        """
        results: List[MaterialPriceResult] = []
        global_warnings: List[str] = []

        for mid in material_ids:
            try:
                res = self.analyze_single_material(
                    identifier=mid,
                    analysis_date=analysis_date,
                    prediction_horizon_days=prediction_horizon_days,
                )
                results.append(res)
            except Exception as e:
                logger.error(f"Error analyzing material '{mid}': {e}")
                global_warnings.append(f"Failed to analyze material '{mid}': {str(e)}")

        # Calculate summary statistics
        high_risk = sum(1 for r in results if r.riskLevel == "HIGH")
        med_risk = sum(1 for r in results if r.riskLevel == "MEDIUM")
        low_risk = sum(1 for r in results if r.riskLevel == "LOW")

        upward = sum(1 for r in results if r.trend == "UPWARD")
        downward = sum(1 for r in results if r.trend == "DOWNWARD")
        stable = sum(1 for r in results if r.trend == "STABLE")

        summary = {
            "totalMaterialsAnalyzed": len(results),
            "highRiskMaterials": high_risk,
            "mediumRiskMaterials": med_risk,
            "lowRiskMaterials": low_risk,
            "upwardTrendMaterials": upward,
            "downwardTrendMaterials": downward,
            "stableTrendMaterials": stable,
        }

        # Resolve effective analysis date string
        effective_date = (
            analysis_date.strftime("%Y-%m-%d")
            if isinstance(analysis_date, (date, datetime))
            else (str(analysis_date) if analysis_date else (results[0].analysisDate if results else datetime.now().strftime("%Y-%m-%d")))
        )

        lag_days = results[0].dataLagDays if results else 0
        pred_date = results[0].predictionDate if results else None
        horizon_exp = results[0].horizonExplanation if results else ""

        return MaterialPriceAnalysisResponse(
            success=True,
            agent="market_price_agent",
            analysisDate=effective_date,
            latestObservationDate=results[0].latestObservationDate if results else None,
            dataLagDays=lag_days,
            requestedPredictionHorizonDays=prediction_horizon_days,
            effectiveForecastHorizonDays=results[0].effectiveForecastHorizonDays if results else prediction_horizon_days,
            predictionHorizonDays=prediction_horizon_days,
            predictionDate=pred_date,
            horizonExplanation=horizon_exp,
            materialsAnalyzed=len(results),
            results=results,
            summary=summary,
            warnings=global_warnings,
        )

    def analyze_all_materials(
        self,
        analysis_date: Optional[Union[date, datetime, str]] = None,
        prediction_horizon_days: int = 15,
    ) -> MaterialPriceAnalysisResponse:
        """
        Analyze all raw materials present in the catalog with price history.
        """
        all_ids = self.repository.get_all_material_ids()
        return self.analyze_materials(
            material_ids=all_ids,
            analysis_date=analysis_date,
            prediction_horizon_days=prediction_horizon_days,
        )

    def monitor_market(
        self,
        analysis_date: Optional[Union[date, datetime, str]] = None,
        lookback_days: int = 30,
        prediction_horizon_days: int = 15,
    ) -> MarketPriceMonitoringResponse:
        """
        Scenario B: Periodic Market Price Monitoring.
        Detects surges, volatility anomalies, cost inflation, and generates price alerts.
        Uses AlertManager to prevent duplicate active alerts, resolve cleared alerts, and preserve history.
        Uses the exact same risk classification policy and thresholds as /analyze.
        """
        all_ids = self.repository.get_all_material_ids()
        materials_analyzed: List[MaterialPriceResult] = []

        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        for mid in all_ids:
            try:
                res = self.analyze_single_material(
                    identifier=mid,
                    analysis_date=analysis_date,
                    prediction_horizon_days=prediction_horizon_days,
                )
                materials_analyzed.append(res)
            except Exception as e:
                logger.error(f"Error monitoring material ID {mid}: {e}")

        # Process alerts via AlertManager (deduplication, lifecycle, history preservation)
        active_alerts, alert_history, resolved_count = self.alert_manager.process_alerts(
            materials_analyzed, timestamp_str=now_str
        )

        # Summary
        summary = {
            "totalMaterialsAnalyzed": len(materials_analyzed),
            "highRiskMaterials": sum(1 for m in materials_analyzed if m.riskLevel == "HIGH"),
            "mediumRiskMaterials": sum(1 for m in materials_analyzed if m.riskLevel == "MEDIUM"),
            "lowRiskMaterials": sum(1 for m in materials_analyzed if m.riskLevel == "LOW"),
            "upwardTrendMaterials": sum(1 for m in materials_analyzed if m.trend == "UPWARD"),
            "downwardTrendMaterials": sum(1 for m in materials_analyzed if m.trend == "DOWNWARD"),
            "stableTrendMaterials": sum(1 for m in materials_analyzed if m.trend == "STABLE"),
            "totalAlerts": len(active_alerts),
            "activeAlertsCount": len(active_alerts),
            "resolvedAlertsCount": resolved_count,
            "totalHistoricalAlerts": len(alert_history),
        }

        # AI Market Overview
        market_overview = self.explanation_service.explain_market_monitoring(
            summary=summary,
            alerts=[a.model_dump() for a in active_alerts],
            materials=[m.model_dump() for m in materials_analyzed],
        )

        effective_date = (
            analysis_date.strftime("%Y-%m-%d")
            if isinstance(analysis_date, (date, datetime))
            else (str(analysis_date) if analysis_date else (materials_analyzed[0].latestObservationDate if materials_analyzed else datetime.now().strftime("%Y-%m-%d")))
        )

        return MarketPriceMonitoringResponse(
            success=True,
            agent="market_price_agent",
            analysisDate=effective_date,
            lookbackDays=lookback_days,
            predictionHorizonDays=prediction_horizon_days,
            alertsGenerated=len(active_alerts),
            resolvedAlertsCount=resolved_count,
            alerts=active_alerts,
            alertHistory=alert_history,
            results=materials_analyzed,
            summary=summary,
            marketOverview=market_overview,
        )


_agent_singleton: Optional[MarketPriceAgent] = None


def get_market_price_agent() -> MarketPriceAgent:
    """Return global MarketPriceAgent singleton."""
    global _agent_singleton
    if _agent_singleton is None:
        _agent_singleton = MarketPriceAgent()
    return _agent_singleton
