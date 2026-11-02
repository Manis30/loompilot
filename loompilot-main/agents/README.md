# LoomPilot AI: Intelligent Manufacturing & Market Intelligence Agents

An enterprise-grade, independent AI agent suite built for **LoomPilot** — an AI-powered textile and garment manufacturing management platform.

The system features two specialized autonomous AI agents integrated into a unified FastAPI backend:
1. **Feasibility AI Agent**: Evaluates whether newly submitted client orders can be manufactured and delivered within requested deadlines by analyzing product BOM recipes, cutting wastage, raw material inventory and supplier lead times, machine capacity, maintenance downtime, workforce attendance and skills, active order commitments, and quality rework buffers. It computes the **earliest feasible delivery date**, explains constraints in executive business language powered by Groq LLM, and provides 5 actionable alternative scenarios.
2. **Market Price AI Agent**: Analyzes historical raw material price movements, predicts future procurement prices using Holt's Linear Trend forecasting, calculates volatility and coefficient of variation, evaluates commodity risks, and generates purchasing guidance.

---

## 1. System Architecture

```text
loompilot_ai/
│
├── LoomPilot Datasets/                    # Read-only Excel business datasets
│   ├── LoomPilot_MarketPrices.xlsx        # 198 weekly price observations (June-Oct 2026)
│   ├── LoomPilot_Materials.xlsx           # Master catalog of 9 raw materials & warehouse stock
│   ├── LoomPilot_Suppliers.xlsx           # 9 textile suppliers with city & lead times
│   ├── LoomPilot_Products.xlsx            # 6 finished garments with specs & fabric requirements
│   ├── LoomPilot_Machines.xlsx            # 12 factory machines across 4 manufacturing stages
│   ├── LoomPilot_MachineStatusLogs.xlsx   # Real-time maintenance & status logs
│   ├── LoomPilot_Employees.xlsx           # 32 factory staff members & departments
│   ├── LoomPilot_Supervisors.xlsx         # Section heads (Cutting, Stitching, Finishing)
│   ├── LoomPilot_EmployeeAttendanceReports.xlsx # Attendance logs (Mean ~90.1% attendance)
│   ├── LoomPilot_Orders.xlsx              # 30 orders (15 active WIP commitments)
│   ├── LoomPilot_OrderMaterials.xlsx      # Procurement records & fabric allocations
│   ├── LoomPilot_SupervisorDailyReports.xlsx # Production outputs & historical defect logs
│   └── LoomPilot_Clients.xlsx             # 10 enterprise retail & wholesale clients
│
├── app/
│   ├── main.py                            # FastAPI application, lifespan & router registration
│   │
│   ├── api/
│   │   └── routes/
│   │       ├── feasibility_routes.py      # REST endpoints (/evaluate, /orders, /health)
│   │       └── market_price_routes.py     # REST endpoints (/analyze, /monitor, /health)
│   │
│   ├── agents/
│   │   ├── feasibility/                   # Feasibility AI Agent
│   │   │   ├── agent.py                   # Central orchestrator & singleton factory
│   │   │   ├── material_evaluator.py      # BOM recipe, 5% cutting wastage & stock reservations
│   │   │   ├── machine_evaluator.py       # Line throughput, maintenance & alternative routing
│   │   │   ├── workforce_evaluator.py     # Supervisor skills & empirical attendance tracking
│   │   │   ├── commitment_evaluator.py    # Active WIP commitments across 15 active orders
│   │   │   ├── production_scheduler.py    # Milestone timeline, earliest feasible date & delay
│   │   │   ├── scenario_engine.py         # 5 actionable alternative business scenarios
│   │   │   └── explanation_service.py     # Groq LLM executive reasoning & deterministic fallback
│   │   │
│   │   └── market_price/                  # Market Price AI Agent
│   │       ├── agent.py                   # Central MarketPriceAgent orchestrator
│   │       ├── analyzer.py                # Historical price & volatility metrics
│   │       ├── prediction_engine.py       # Holt's linear forecasting & confidence
│   │       ├── risk_analyzer.py           # Multi-factor risk classification
│   │       ├── recommendation_engine.py   # Purchasing advisory heuristics
│   │       └── explanation_service.py     # Groq LLM & deterministic fallback
│   │
│   ├── llm/
│   │   ├── groq_client.py                 # Reusable Groq API client with connection timeout
│   │   └── prompts/
│   │       ├── feasibility_prompt.py      # Strict anti-hallucination feasibility prompts
│   │       └── market_price_prompt.py     # Anti-hallucination market price prompts
│   │
│   ├── data/
│   │   ├── excel_loader.py                # Type-safe openpyxl Excel loader
│   │   ├── data_validator.py              # Schema, integrity & duplicate validator
│   │   └── data_repository.py             # Abstracted unified repository for all datasets
│   │
│   ├── schemas/
│   │   ├── feasibility_schema.py          # Pydantic schemas for Feasibility API & evaluators
│   │   └── market_price_schema.py         # Pydantic schemas for Market Price API & evaluators
│   │
│   ├── core/
│   │   ├── config.py                      # App settings & risk thresholds
│   │   └── logging.py                     # Structured logging configuration
│   │
│   └── utils/
│       └── math_helpers.py                # OLS regression, anomaly detection, CV calculations
│
├── tests/                                 # 76 unit & integration tests (100% pass)
│   ├── conftest.py                        # Fixtures & environment setup (offline Groq safety)
│   ├── test_feasibility_agent.py          # 15 tests covering all manufacturing constraints
│   ├── test_feasibility_routes.py         # 6 tests for FastAPI feasibility endpoints
│   ├── test_data_loader.py                # Excel loader tests
│   ├── test_data_validator.py             # Dataset schema validation tests
│   ├── test_data_repository.py            # Data repository query tests
│   ├── test_analyzer.py                   # Market price analytics tests
│   ├── test_prediction_engine.py          # Time-series forecasting tests
│   ├── test_risk_analyzer.py              # Commodity risk tests
│   ├── test_recommendation_engine.py      # Procurement advisory tests
│   ├── test_groq_client.py                # LLM client tests
│   ├── test_agent.py                      # Market price agent tests
│   └── test_api_routes.py                 # Market price route tests
│
├── docs/
│   ├── feasibility_agent.md               # Technical architecture & mathematical specifications
│   ├── market_price_agent.md              # Technical architecture & forecasting formulations
│   ├── dataset_analysis.md                # Comprehensive dataset analysis & field mapping
│   └── api_documentation.md               # Complete REST API reference & cURL examples
│
├── .env                                   # Local configuration
├── .env.example                           # Configuration template
├── pytest.ini                             # Pytest configuration
├── requirements.txt                       # Python dependencies
└── README.md                              # Main documentation
```

---

## 2. Feasibility AI Agent

### 2.1. Primary Objective & Capabilities
The Feasibility AI Agent assesses whether an incoming client order can be successfully manufactured and delivered within the client's requested deadline.

It evaluates 8 distinct manufacturing dimensions:
1. **Raw Material Availability & BOM**:
   - Computes standard material consumption per unit from `LoomPilot_Products.xlsx`.
   - Incorporates a validated **5% fabric cutting wastage rate** ($1.05 \times \text{StandardFabricKgPerUnit}$).
   - Dynamically subtracts committed stock from 15 active orders to determine true *unreserved available stock*.
   - Evaluates supplier procurement lead times (e.g., South Loom Supplies: 4 days) if a shortage exists.
2. **Machine Capacity & Maintenance**:
   - Assesses stage throughput across Cutting (400–450 units/day), Stitching (180 units/day per single line), Finishing (350 units/day), and Packing (500 units/day).
   - Identifies machine status: detects machines undergoing maintenance (such as `ST-02` and `FIN-03`) and dynamically routes production to compatible operational alternatives (`ST-01`, `ST-03`, `STI-04`, `FIN-01`, `QC-01`).
3. **Workforce Availability & Skills**:
   - Evaluates department headcount and supervisor assignment (`Suresh Kumar` for Cutting, `Meena Ravi` for Stitching, `Arun Prakash` for Finishing/Packing).
   - Uses empirical attendance rates (~90.1% mean from 120 attendance records) to calculate effective operator capacity.
4. **Existing Production Commitments (WIP Backlog)**:
   - Tracks 15 active orders in the factory (Orders 11–20 and 26–30), accounting for over 2,600 kg of cotton fabric already committed to ongoing jobs.
5. **Production Scheduling & Critical Path**:
   - Builds sequential milestone timeline: Procurement $\rightarrow$ Cutting $\rightarrow$ Stitching $\rightarrow$ Finishing & QC $\rightarrow$ Packing & Dispatch.
   - Accounts for process dependencies and adds a **1-day quality/rework buffer** justified by historical 1.57% defect rates.
6. **Feasibility Classification**:
   - `FEASIBLE`: All constraints satisfied; order delivered on or before requested date.
   - `CONDITIONALLY_FEASIBLE`: Feasible with specific corrective action (e.g. material procurement or alternative machine routing).
   - `NOT_FEASIBLE`: Hard constraint (e.g. order quantity exceeds physical factory capacity within timeframe).
   - `NEEDS_INFORMATION`: Missing BOM recipe or critical parameter.
7. **Earliest Feasible Delivery Date**:
   - Calculates the exact earliest feasible date when requested delivery is unachievable, along with the specific critical path bottleneck and delay days.
8. **Executive Explanation Engine**:
   - Generates plain-language business reasoning powered by Groq LLM (`llama-3.3-70b-versatile`), explaining *What is wrong*, *Why it is happening*, *Which resource is affected*, and *How to solve it*.
   - Features deterministic rule-based fallback when offline.
9. **Alternative Scenario Analysis**:
   - Evaluates 5 realistic scenarios:
     1. Expedited Material Procurement (lead time compression).
     2. Multi-Line Stitching Allocation (parallel line balancing).
     3. Overtime / Weekend Shift (extended shift hours).
     4. Extended Delivery Schedule (realistic timeline acceptance).
     5. Partial Delivery (split dispatch of completed batches).

---

## 3. Market Price AI Agent

### 3.1. Primary Objective & Capabilities
The Market Price AI Agent tracks, forecasts, and advises on raw material procurement prices:
- **Historical Trend & Volatility Analysis**: Analyzes 198 weekly price observations across 9 materials, calculating 7-day/30-day averages, price-level CV, and daily/weekly log-return volatilities.
- **Double Exponential Smoothing (Holt's Linear Model)**: Projects prices for 7, 15, 30, and 60-day horizons with in-sample grid-search optimization for $\alpha$ and $\beta$.
- **Model-Fit Confidence Safeguard**: Holds back low-$R^2$ forecasts from receiving `HIGH` confidence ratings regardless of sample size.
- **Stateful Alert Lifecycle & Deduplication**: Features `AlertManager` that deduplicates active alerts and transitions resolved alerts when commodity rates normalize.
- **Procurement Advisories**: Recommends strategic buying decisions based on current warehouse stock and supplier lead times.

---

## 4. Environment Setup & Installation

### Step 1: Clone or Open Project
```bash
cd loompilot_ai
```

### Step 2: Create and Activate Virtual Environment
```bash
# Windows
python -m venv .venv
.\.venv\Scripts\activate

# Linux / macOS
python3 -m venv .venv
source .venv/bin/activate
```

### Step 3: Install Dependencies
```bash
pip install -r requirements.txt
```

---

## 5. Configuration

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Key environment settings:
```ini
ENVIRONMENT=development
DEBUG=false
HOST=0.0.0.0
PORT=8000

# Path to LoomPilot Datasets folder
DATASET_DIR=LoomPilot Datasets

# Groq LLM Configuration (Optional: defaults to deterministic fallback if omitted)
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_TIMEOUT_SECONDS=15.0

# Risk Thresholds
RISK_VOLATILITY_LOW_THRESHOLD=3.0
RISK_VOLATILITY_HIGH_THRESHOLD=7.0
RISK_PRICE_CHANGE_HIGH_THRESHOLD=3.0
RISK_FORECAST_INCREASE_HIGH_THRESHOLD=4.0
RISK_DATA_STALENESS_DAYS_THRESHOLD=14
MIN_OBSERVATIONS_FOR_PREDICTION=4
```

---

## 6. Running the Application

Start the FastAPI server:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Once started:
- **Interactive Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc Interactive Docs**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **Service Root Directory**: [http://localhost:8000/](http://localhost:8000/)

---

## 7. Running the Test Suite

The test suite contains **76 comprehensive unit and integration tests** covering both AI agents, loaders, validators, mathematical engines, Groq fallbacks, and REST routes.

```bash
# Run all tests
python -m pytest

# Run specifically Feasibility Agent tests
python -m pytest tests/test_feasibility_agent.py tests/test_feasibility_routes.py

# Run specifically Market Price Agent tests
python -m pytest tests/test_agent.py tests/test_analyzer.py tests/test_prediction_engine.py
```

Expected Output:
```text
============================== 76 passed in 12.30s ==============================
```

---

## 8. REST API Reference

### 8.1. Feasibility AI Agent Endpoints

#### `POST /api/agents/feasibility/evaluate`
Evaluates manufacturing feasibility for an order.

**Request Body (Existing Order):**
```json
{
  "tenantId": "tenant_default",
  "orderId": "ORD-021"
}
```

**Request Body (Custom Order Simulation):**
```json
{
  "tenantId": "tenant_default",
  "customOrder": {
    "orderNumber": "SIM-999",
    "productName": "Cotton Polo T-Shirt",
    "orderQuantity": 800,
    "requestedDeliveryDate": "2026-11-15"
  }
}
```

**Key Response Fields:**
- `status`: `"FEASIBLE"`, `"CONDITIONALLY_FEASIBLE"`, `"NOT_FEASIBLE"`, or `"NEEDS_INFORMATION"`
- `earliestFeasibleDeliveryDate`: Calculated earliest delivery date (e.g. `"2026-10-30"`)
- `delayDays`: Integer days late against requested date (`0` if on schedule)
- `criticalPathBottleneck`: Main limiting factor (e.g., `"Raw Material Procurement (Cotton Fabric)"`)
- `checks`: Detailed sub-evaluations for `material`, `machine`, `workforce`, `commitments`, and `productionSchedule`
- `issues`: Structured list with `title`, `severity`, `actualAvailable`, `required`, `explanation`, and `recommendedSolution`
- `recommendations`: Prioritized list of actionable business steps
- `alternativeScenarios`: 5 scenarios with tradeoff analysis and expected completion dates
- `executiveExplanation`: Clear narrative formatted for factory management

#### `GET /api/agents/feasibility/orders`
Lists available factory orders with quantity, product, status, and dates.

#### `GET /api/agents/feasibility/health`
Returns agent health, loaded catalog counts (orders, products, machines, employees), and Groq LLM status.

---

### 8.2. Market Price AI Agent Endpoints

#### `POST /api/agents/market-price/analyze`
Analyzes raw material price trends and forecasts future prices.
```json
{
  "materialIds": [1, "MAT_02", "Buttons"],
  "analysisDate": "2026-10-30",
  "predictionHorizonDays": 15
}
```

#### `POST /api/agents/market-price/analyze-all`
Analyzes all 9 raw materials in the catalog.

#### `POST /api/agents/market-price/monitor`
Performs periodic surveillance, identifying price surges and volatility spikes.

#### `GET /api/agents/market-price/datasets`
Returns discovered dataset metadata, sheet names, row counts, and quality metrics.

#### `GET /api/agents/market-price/health`
Health check and Groq connectivity status.

---

## 9. cURL Quick Start

```bash
# 1. Feasibility Assessment for Order ORD-021
curl -X POST "http://localhost:8000/api/agents/feasibility/evaluate" \
     -H "Content-Type: application/json" \
     -d '{"tenantId": "tenant_default", "orderId": "ORD-021"}'

# 2. Check Feasibility Agent Health
curl -X GET "http://localhost:8000/api/agents/feasibility/health"

# 3. Analyze Market Price for Cotton Fabric
curl -X POST "http://localhost:8000/api/agents/market-price/analyze" \
     -H "Content-Type: application/json" \
     -d '{"materialIds": [1], "predictionHorizonDays": 15}'

# 4. Market Price Monitoring
curl -X POST "http://localhost:8000/api/agents/market-price/monitor" \
     -H "Content-Type: application/json" \
     -d '{"lookbackDays": 30}'
```

---

## 10. Design Assumptions & Boundary Conditions

1. **Advisory Role**: The Feasibility AI Agent and Market Price Agent are purely advisory. They provide recommendations, alternative scenarios, and feasibility assessments without making unapproved mutations to actual ERP orders, warehouse inventory, or staff rosters.
2. **Cutting Wastage Rate**: Based on textile industry standards and verified order data, fabric cutting incorporates a standard **5% wastage allowance** ($1.05 \times \text{BOM Quantity}$).
3. **Machine Line Capacity**: Single-line stitching throughput is calibrated to **180 units/day**. For orders requiring high-volume throughput, the agent evaluates multi-line balancing across operational standby machines (`ST-01`, `ST-03`, `STI-04`).
4. **Maintenance Awareness**: Machines flagged under maintenance in status logs (e.g. `ST-02`, `FIN-03`) are automatically excluded from primary allocation and flagged as maintenance constraints.
5. **Quality Buffer**: A **1-day rework and inspection buffer** is scheduled between finishing and dispatch, calibrated to the empirical **1.57% defect rate** observed across supervisor daily reports.
6. **LLM Anti-Hallucination Guardrails**: Prompts are constrained to structured JSON facts generated by deterministic mathematical evaluators. If Groq LLM is unavailable or unconfigured, the system automatically falls back to deterministic business reasoning templates.
