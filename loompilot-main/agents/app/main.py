from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.logging import setup_logging, get_logger
from app.data.data_repository import (
    MaterialNotFoundError,
    OrderNotFoundError,
    ProductNotFoundError,
    get_data_repository,
)
from app.llm.groq_client import get_groq_client
from app.api.routes.market_price_routes import router as market_price_router
from app.api.routes.feasibility_routes import router as feasibility_router
from app.api.routes.quotation_routes import router as quotation_router
from app.api.routes.client_assistant_routes import router as client_assistant_router
from app.api.routes.supplier_assistant_routes import router as supplier_assistant_router
from app.api.routes.monitoring_routes import router as monitoring_router
from app.agents.client_assistant.customer_service import (
    CustomerNotFoundError,
    CustomerOwnershipError,
)

setup_logging(level=0 if settings.DEBUG else 20)
logger = get_logger("loompilot.main")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager for startup and shutdown routines."""
    logger.info("Initializing LoomPilot Market Price Agent service...")

    # Pre-load and validate Excel datasets
    try:
        repo = get_data_repository()
        logger.info(
            f"Repository initialized successfully with {len(repo.get_all_material_ids())} materials "
            f"and {len(repo._prices_df)} price observations."
        )
    except Exception as e:
        logger.error(f"Failed to pre-load datasets during startup: {e}", exc_info=True)

    # Initialize Groq client check
    groq_client = get_groq_client()
    if groq_client.is_configured:
        logger.info(f"Groq LLM is configured (Model: {groq_client.model}).")
    else:
        logger.info("Groq API key not configured. Agent running in deterministic template explanation mode.")

    yield

    logger.info("Shutting down LoomPilot Market Price Agent service...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "AI-powered Market Price Agent for LoomPilot textile and garment manufacturing platform. "
        "Provides raw material price movement analysis, time-series forecasting (7, 15, 30 days), "
        "volatility tracking, risk classification, procurement recommendations, and Groq-driven business reasoning."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Agent Routes
app.include_router(market_price_router)
app.include_router(feasibility_router)
app.include_router(quotation_router)
app.include_router(client_assistant_router)
app.include_router(supplier_assistant_router)
app.include_router(monitoring_router)


# Global Exception Handlers
@app.exception_handler(CustomerNotFoundError)
async def customer_not_found_handler(request: Request, exc: CustomerNotFoundError):
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={
            "success": False,
            "error": "CustomerNotFoundError",
            "message": str(exc),
        },
    )


@app.exception_handler(CustomerOwnershipError)
async def customer_ownership_handler(request: Request, exc: CustomerOwnershipError):
    return JSONResponse(
        status_code=status.HTTP_403_FORBIDDEN,
        content={
            "success": False,
            "error": "CustomerOwnershipError",
            "message": str(exc),
        },
    )

@app.exception_handler(MaterialNotFoundError)
async def material_not_found_handler(request: Request, exc: MaterialNotFoundError):
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={
            "success": False,
            "error": "MaterialNotFoundError",
            "message": str(exc),
        },
    )


@app.exception_handler(OrderNotFoundError)
async def order_not_found_handler(request: Request, exc: OrderNotFoundError):
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={
            "success": False,
            "error": "OrderNotFoundError",
            "message": str(exc),
        },
    )


@app.exception_handler(ProductNotFoundError)
async def product_not_found_handler(request: Request, exc: ProductNotFoundError):
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={
            "success": False,
            "error": "ProductNotFoundError",
            "message": str(exc),
        },
    )


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "success": False,
            "error": "ValueError",
            "message": str(exc),
        },
    )


@app.get("/", tags=["General"])
def root():
    """Welcome and status endpoint."""
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "online",
        "documentation": "/docs",
        "endpoints": {
            "analyze_material_prices": f"{settings.API_PREFIX}/analyze",
            "analyze_all_materials": f"{settings.API_PREFIX}/analyze-all",
            "market_price_monitoring": f"{settings.API_PREFIX}/monitor",
            "dataset_information": f"{settings.API_PREFIX}/datasets",
            "health_check": f"{settings.API_PREFIX}/health",
            "feasibility_evaluate": "/api/agents/feasibility/evaluate",
            "feasibility_health": "/api/agents/feasibility/health",
            "feasibility_orders": "/api/agents/feasibility/orders",
            "quotation_generate": "/api/agents/quotation/generate",
            "quotation_health": "/api/agents/quotation/health",
            "quotation_list": "/api/agents/quotation",
            "client_assistant_chat": "/api/agents/client-assistant/chat",
            "client_assistant_conversations": "/api/agents/client-assistant/conversations",
            "client_assistant_pending_approvals": "/api/agents/client-assistant/approvals/pending",
            "client_assistant_health": "/api/agents/client-assistant/health",
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)

