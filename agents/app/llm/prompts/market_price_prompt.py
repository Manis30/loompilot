import json
from typing import Any, Dict, List

SYSTEM_PROMPT_MATERIAL_EXPLANATION = """You are LoomPilot's expert Textile Raw Material Procurement AI Analyst.
Your responsibility is to explain calculated market price movements, forecast trajectories, and risk evaluations to factory management.

STRICT INSTRUCTIONS:
1. Ground your explanation EXCLUSIVELY on the structured mathematical values supplied in the user prompt.
2. NEVER invent, hallucinate, or alter any prices, percentage changes, dates, or supplier details.
3. NEVER describe price-level CV as annualized volatility. Use correct statistical terminology: describe priceLevelCV as price-level dispersion (relative spread) and weeklyReturnVolatility as weekly percentage return volatility.
4. Do NOT repeat the purchasing recommendation sentence verbatim. Instead, explain the practical market rationale and primary risk drivers behind the procurement strategy.
5. Treat future forecasts as statistical projections with confidence bounds, never as guaranteed future prices.
6. Clearly mention the requested forecast horizon and distinguish it from the effective forecast horizon (accounting for any observation lag between the latest data and analysis date).
7. Provide a direct, professional, executive-ready summary (2 to 4 sentences) without markdown headers or bullet points."""


def format_material_prompt(data: Dict[str, Any]) -> str:
    """Format single material analysis results into an LLM prompt."""
    payload = {
        "material": {
            "id": data.get("materialId"),
            "name": data.get("materialName"),
            "unit": data.get("unit"),
            "currency": data.get("currency", "INR"),
            "currentStock": data.get("currentStock"),
        },
        "supplier": data.get("supplierInfo"),
        "historicalMetrics": {
            "currentPrice": data.get("currentPrice"),
            "previousPrice": data.get("previousPrice"),
            "priceChange": data.get("priceChange"),
            "priceChangePercentage": data.get("priceChangePercentage"),
            "dailyChangePercentage": data.get("dailyChangePercentage"),
            "sevenDayAveragePrice": data.get("sevenDayAveragePrice"),
            "thirtyDayAveragePrice": data.get("thirtyDayAveragePrice"),
            "monthlyPriceMovement": data.get("monthlyPriceMovement"),
            "minHistoricalPrice": data.get("minHistoricalPrice"),
            "maxHistoricalPrice": data.get("maxHistoricalPrice"),
            "priceLevelCV": data.get("priceLevelCV"),
            "weeklyReturnVolatility": data.get("weeklyReturnVolatility"),
            "dailyReturnVolatility": data.get("dailyReturnVolatility"),
            "trend": data.get("trend"),
            "totalObservations": data.get("totalObservations"),
            "latestObservationDate": data.get("latestObservationDate"),
        },
        "horizonAndDates": {
            "latestObservationDate": data.get("latestObservationDate"),
            "analysisDate": data.get("analysisDate"),
            "requestedPredictionHorizonDays": data.get("requestedPredictionHorizonDays"),
            "effectiveForecastHorizonDays": data.get("effectiveForecastHorizonDays"),
            "predictionDate": data.get("predictionDate"),
        },
        "forecast": {
            "predictedPrice": data.get("predictedPrice"),
            "predictedChangePercentage": data.get("predictedChangePercentage"),
            "predictionDate": data.get("predictionDate"),
            "predictionHorizonDays": data.get("predictionHorizonDays"),
            "lowerBound": data.get("lowerConfidenceBound"),
            "upperBound": data.get("upperConfidenceBound"),
            "confidence": data.get("confidence"),
            "confidenceBreakdown": data.get("confidenceBreakdown"),
        },
        "riskAndRecommendation": {
            "riskLevel": data.get("riskLevel"),
            "riskFactors": data.get("riskFactors", []),
            "riskBreakdown": data.get("riskBreakdown"),
            "recommendation": data.get("recommendation"),
            "warnings": data.get("warnings", []),
        },
    }

    return (
        "Analyze the following calculated raw material market price metrics and provide "
        "a concise, management-friendly explanation:\n\n"
        f"{json.dumps(payload, indent=2, default=str)}"
    )


SYSTEM_PROMPT_MARKET_MONITORING = """You are LoomPilot's Senior Textile Sourcing AI Advisor.
Your role is to provide a concise executive overview of weekly factory raw material market conditions.

STRICT INSTRUCTIONS:
1. Base your summary solely on the provided market metrics, triggered alerts, and risk tallies.
2. Never invent numbers, percentages, or supplier details.
3. Highlight high-risk materials requiring immediate management attention.
4. Note stable materials suitable for regular scheduling.
5. Provide actionable strategic advice in 3 to 5 concise sentences."""


def format_monitoring_prompt(
    summary: Dict[str, Any],
    alerts: List[Dict[str, Any]],
    materials: List[Dict[str, Any]],
) -> str:
    """Format market monitoring snapshot for the LLM."""
    mat_briefs = [
        {
            "id": m.get("materialId"),
            "name": m.get("materialName"),
            "currentPrice": m.get("currentPrice"),
            "predictedPrice": m.get("predictedPrice"),
            "predictedChangePercentage": m.get("predictedChangePercentage"),
            "riskLevel": m.get("riskLevel"),
            "trend": m.get("trend"),
        }
        for m in materials
    ]

    payload = {
        "marketSummary": summary,
        "activeAlerts": alerts,
        "materialSnapshots": mat_briefs,
    }

    return (
        "Review the periodic market monitoring results and summarize current raw material conditions "
        "for executive leadership:\n\n"
        f"{json.dumps(payload, indent=2, default=str)}"
    )

