from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.config import settings
from app.core.logging import get_logger
from app.data.data_repository import DataRepository, MaterialNotFoundError, get_data_repository
from app.agents.market_price.agent import MarketPriceAgent, get_market_price_agent
from app.llm.groq_client import GroqClient, get_groq_client
from app.schemas.market_price_schema import (
    MaterialPriceAnalysisRequest,
    AnalyzeAllRequest,
    MarketPriceMonitoringRequest,
    MaterialPriceAnalysisResponse,
    MarketPriceMonitoringResponse,
    DatasetInfoResponse,
    HealthCheckResponse,
    DatasetFileMetadata,
    DatasetSheetInfo,
)

logger = get_logger(__name__)

router = APIRouter(prefix=settings.API_PREFIX, tags=["Market Price Agent"])


@router.post(
    "/analyze",
    response_model=MaterialPriceAnalysisResponse,
    summary="Analyze specific raw material prices",
    description=(
        "Analyzes historical market prices, evaluates trends and volatility, predicts future prices "
        "for requested horizons (e.g. 7, 15, 30 days), generates purchasing recommendations, "
        "and produces Groq-powered management explanations for requested materials."
    ),
    status_code=status.HTTP_200_OK,
)
def analyze_material_prices(
    payload: MaterialPriceAnalysisRequest,
    agent: MarketPriceAgent = Depends(get_market_price_agent),
) -> MaterialPriceAnalysisResponse:
    try:
        response = agent.analyze_materials(
            material_ids=payload.materialIds,
            analysis_date=payload.analysisDate,
            prediction_horizon_days=payload.predictionHorizonDays or 15,
        )
        if not response.results and response.warnings:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"message": "No materials could be analyzed.", "errors": response.warnings},
            )
        return response
    except HTTPException:
        raise
    except MaterialNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in /analyze endpoint: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal server error occurred while analyzing material prices.",
        )


@router.post(
    "/analyze-all",
    response_model=MaterialPriceAnalysisResponse,
    summary="Analyze all catalog raw materials",
    description="Executes historical analysis and predictive forecasting for all materials with sufficient data.",
    status_code=status.HTTP_200_OK,
)
def analyze_all_materials(
    payload: AnalyzeAllRequest,
    agent: MarketPriceAgent = Depends(get_market_price_agent),
) -> MaterialPriceAnalysisResponse:
    try:
        return agent.analyze_all_materials(
            analysis_date=payload.analysisDate,
            prediction_horizon_days=payload.predictionHorizonDays or 15,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in /analyze-all endpoint: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal server error occurred during complete catalog analysis.",
        )


@router.post(
    "/monitor",
    response_model=MarketPriceMonitoringResponse,
    summary="Periodic market price monitoring and anomaly alerts",
    description=(
        "Performs periodic surveillance across all raw materials, detects sudden price spikes, "
        "high volatility categories, rapid inflation forecasts, and generates actionable market alerts."
    ),
    status_code=status.HTTP_200_OK,
)
def monitor_market_prices(
    payload: MarketPriceMonitoringRequest,
    agent: MarketPriceAgent = Depends(get_market_price_agent),
) -> MarketPriceMonitoringResponse:
    try:
        return agent.monitor_market(
            analysis_date=payload.analysisDate,
            lookback_days=payload.lookbackDays or 30,
            prediction_horizon_days=payload.predictionHorizonDays or 15,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in /monitor endpoint: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal server error occurred while monitoring market prices.",
        )


@router.get(
    "/datasets",
    response_model=DatasetInfoResponse,
    summary="Dataset metadata and data quality information",
    description="Inspects and returns structural details, row counts, sheets, columns, and quality metrics.",
    status_code=status.HTTP_200_OK,
)
def get_dataset_information(
    repo: DataRepository = Depends(get_data_repository),
) -> DatasetInfoResponse:
    try:
        raw_meta = repo.get_dataset_metadata()

        # Build list of dataset file descriptors
        inspection = raw_meta.get("inspection", {})
        datasets_list = []

        relevant_files = {
            "LoomPilot_MarketPrices.xlsx": "Primary time-series dataset containing weekly raw material market prices.",
            "LoomPilot_Materials.xlsx": "Master raw material catalog with standard rates, inventory units, and supplier references.",
            "LoomPilot_Suppliers.xlsx": "Directory of textile suppliers with location details and delivery lead time in days.",
            "LoomPilot_OrderMaterials.xlsx": "Locked historical procurement line item costs contracted for manufacturing orders.",
            "LoomPilot_Orders.xlsx": "Production order schedule, customer delivery commitments, and quantities.",
            "LoomPilot_Quotations.xlsx": "Costing quotations, internal factory cost estimates, and client quoted values.",
            "LoomPilot_Products.xlsx": "Garment product specifications and standard fabric consumption per unit.",
            "priceObservations_dummy_data.xlsx": "Synthetic demonstration dataset for MongoDB schema evaluation (not used for real quotations).",
        }

        for fname, sheets_info in inspection.items():
            is_relevant = fname in relevant_files
            desc = relevant_files.get(fname, "Operational factory data (attendance, machines, employees, reports).")

            parsed_sheets = []
            if isinstance(sheets_info, list):
                for s in sheets_info:
                    if "error" not in s:
                        parsed_sheets.append(
                            DatasetSheetInfo(
                                sheetName=s.get("sheetName", "Sheet1"),
                                rowCount=s.get("rowCount", 0),
                                columnCount=s.get("columnCount", 0),
                                columns=s.get("columns", []),
                            )
                        )

            datasets_list.append(
                DatasetFileMetadata(
                    filename=fname,
                    sheets=parsed_sheets,
                    isRelevantToAgent=is_relevant,
                    description=desc,
                )
            )

        return DatasetInfoResponse(
            success=True,
            datasetDirectory=raw_meta["datasetDirectory"],
            totalDatasetsDiscovered=raw_meta["totalDatasetsDiscovered"],
            primaryMarketDataset=raw_meta["primaryMarketDataset"],
            datasets=datasets_list,
            totalMaterialsAvailable=raw_meta["totalMaterialsAvailable"],
            totalObservations=raw_meta["totalObservations"],
            dateRange=raw_meta["dateRange"],
            dataQualitySummary=raw_meta["dataQualitySummary"],
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving dataset information: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve dataset information.",
        )


@router.get(
    "/health",
    response_model=HealthCheckResponse,
    summary="Agent health and Groq connectivity status",
    description="Returns agent operational status, dataset metrics, and Groq LLM integration status without exposing credentials.",
    status_code=status.HTTP_200_OK,
)
def get_agent_health(
    repo: DataRepository = Depends(get_data_repository),
    groq_client: GroqClient = Depends(get_groq_client),
) -> HealthCheckResponse:
    try:
        materials = repo.get_all_material_ids()
        total_obs = len(repo._prices_df) if repo._prices_df is not None else 0
        groq_health = groq_client.check_health()

        return HealthCheckResponse(
            status="healthy",
            agent="market_price_agent",
            version=settings.VERSION,
            datasetsLoaded=True,
            datasetPath=str(repo.loader.dataset_dir),
            totalMaterials=len(materials),
            totalObservations=total_obs,
            groqConfigured=groq_health.get("configured", False),
            groqConnected=groq_health.get("connected", False),
            groqModel=settings.GROQ_MODEL,
        )
    except Exception as e:
        logger.error(f"Health check failed: {e}", exc_info=True)
        return HealthCheckResponse(
            status="degraded",
            agent="market_price_agent",
            version=settings.VERSION,
            datasetsLoaded=False,
            datasetPath=str(settings.dataset_path),
            totalMaterials=0,
            totalObservations=0,
            groqConfigured=False,
            groqConnected=False,
            groqModel=settings.GROQ_MODEL,
        )
