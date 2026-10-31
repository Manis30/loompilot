# LoomPilot AI Agents: API Documentation

Base URL: `http://localhost:8000`  
Market Price Agent Prefix: `/api/agents/market-price`  
Feasibility Agent Prefix: `/api/agents/feasibility`

---

## 1. Overview of Endpoints

### 1.1. Market Price Agent
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/agents/market-price/analyze` | Analyze specific material prices for order planning |
| `POST` | `/api/agents/market-price/analyze-all` | Analyze all raw materials in the active catalog |
| `POST` | `/api/agents/market-price/monitor` | Execute periodic market surveillance & anomaly alerts |
| `GET` | `/api/agents/market-price/datasets` | Retrieve metadata and quality metrics of Excel datasets |
| `GET` | `/api/agents/market-price/health` | Health check & Groq LLM connectivity status |

### 1.2. Feasibility AI Agent
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/agents/feasibility/evaluate` | Comprehensive manufacturing feasibility assessment of client orders |
| `GET` | `/api/agents/feasibility/orders` | List available orders for feasibility evaluation |
| `GET` | `/api/agents/feasibility/health` | Health check, resource counts & Groq LLM connectivity status |

### 1.3. Quotation AI Agent
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/agents/quotation/generate` | Generate detailed bottom-up manufacturing quotation |
| `GET` | `/api/agents/quotation` | Query manufacturing quotations with tenant & status filters |
| `GET` | `/api/agents/quotation/{id}` | Retrieve quotation detail with multi-tenant isolation |
| `POST` | `/api/agents/quotation/{id}/approve` | Authorized manager approval of quotation |
| `POST` | `/api/agents/quotation/{id}/reject` | Record rejection with reason |
| `GET` | `/api/agents/quotation/health` | Quotation Agent operational health & dataset metrics |

### 1.4. System
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Root welcome, active agent status & service directory |

---

## 2. Endpoint Details

### 2.1. `POST /api/agents/market-price/analyze`
Analyzes historical prices, calculates volatility and trend, forecasts future prices (e.g. 7, 15, 30 days), generates purchasing guidance, and provides AI-powered explanations for requested raw materials.

#### Request Headers
```http
Content-Type: application/json
```

#### Request Body
| Field | Type | Required | Default | Description |
| :--- | :--- | :---: | :---: | :--- |
| `materialIds` | `List[Union[int, str]]` | **Yes** | — | List of material identifiers (IDs: `1`, codes: `"MAT_01"`, names: `"Cotton Fabric"`) |
| `analysisDate` | `string (YYYY-MM-DD)` | No | `null` | Historical cutoff date; defaults to the latest observation date |
| `predictionHorizonDays`| `integer` | No | `15` | Forecasting horizon in days ($1 \le h \le 180$) |

```json
{
  "materialIds": [1, "MAT_02", "Buttons"],
  "analysisDate": "2026-10-30",
  "predictionHorizonDays": 15
}
```

#### Successful Response (`200 OK`)
```json
{
  "success": true,
  "agent": "market_price_agent",
  "analysisDate": "2026-10-30",
  "predictionHorizonDays": 15,
  "materialsAnalyzed": 3,
  "results": [
    {
      "materialId": 1,
      "materialName": "Cotton Fabric",
      "unit": "kg",
      "currency": "INR",
      "currentPrice": 245.16,
      "previousPrice": 244.05,
      "priceChange": 1.11,
      "priceChangePercentage": 0.45,
      "dailyChangePercentage": 0.065,
      "sevenDayAveragePrice": 244.61,
      "thirtyDayAveragePrice": 240.12,
      "minHistoricalPrice": 182.0,
      "maxHistoricalPrice": 245.16,
      "priceLevelCV": 8.97,
      "historicalVolatilityCV": 8.97,
      "weeklyReturnVolatility": 1.40,
      "dailyReturnVolatility": 0.53,
      "latestObservationDate": "2026-10-26",
      "analysisDate": "2026-10-30",
      "requestedPredictionHorizonDays": 15,
      "effectiveForecastHorizonDays": 19,
      "predictionHorizonDays": 15,
      "predictionDate": "2026-11-14",
      "predictedPrice": 251.59,
      "predictedChangePercentage": 2.62,
      "lowerConfidenceBound": 245.18,
      "upperConfidenceBound": 258.01,
      "riskLevel": "MEDIUM",
      "riskBreakdown": {
        "totalRiskScore": 2.0,
        "finalRiskLevel": "MEDIUM",
        "contributions": [
          {
            "category": "Return Volatility",
            "score": 1,
            "metric": "weeklyReturnVolatility: 1.40%",
            "description": "Moderate return volatility: Weekly return standard deviation is 1.40%."
          },
          {
            "category": "Forecasted Inflation",
            "score": 1,
            "metric": "predictedChangePercentage: +2.62%",
            "description": "Moderate upward price pressure: Projected change of +2.62% over 19 days."
          },
          {
            "category": "Price Velocity",
            "score": 0,
            "metric": "isSuddenSurge: False, isSuddenDecline: False",
            "description": "No abnormal price surges detected."
          },
          {
            "category": "Data Freshness",
            "score": 0,
            "metric": "dataFreshnessDays: 4",
            "description": "Market data is fresh (4 days old)."
          },
          {
            "category": "Data Verification",
            "score": 0,
            "metric": "unverifiedCount: 0",
            "description": "All historical observations verified."
          },
          {
            "category": "Sample Size",
            "score": 0,
            "metric": "observationCount: 22",
            "description": "Sufficient historical sample size (22 observations)."
          }
        ]
      },
      "confidence": "HIGH",
      "confidenceBreakdown": {
        "observationCount": 22,
        "MAPE": 1.34,
        "R2": 0.82,
        "dataFreshnessDays": 4,
        "volatilityScore": 1,
        "sampleSizeScore": 3,
        "modelFitScore": 3,
        "freshnessScore": 2,
        "totalConfidenceScore": 9,
        "finalConfidenceLevel": "HIGH"
      },
      "trend": "UPWARD",
      "recommendation": "Monitor price trajectory and align purchase with standard order batching: Cotton Fabric exhibits moderate risk with a forecasted increase of +2.62% over an effective 19-day horizon (251.59 INR/kg). Review current warehouse stock (1,250 kg) and prepare procurement requisitions if buffer stock is depleted (Supplier lead time: 4 days).",
      "riskFactors": [
        "Moderate return volatility: Weekly return standard deviation is 1.40%.",
        "Moderate upward price pressure: Projected change of +2.62% over 19 days."
      ],
      "warnings": [],
      "supplierInfo": {
        "supplierId": 1,
        "supplierName": "South Loom Supplies",
        "city": "Coimbatore",
        "leadTimeDays": 4
      },
      "explanation": "Cotton Fabric is currently priced at 245.16 INR/kg, having increased by 0.45% from its prior quote of 244.05 INR/kg. Over the observation period, the commodity has maintained a upward trend with a price-level dispersion of 8.97% CV and weekly return volatility of 1.40%. Over an effective forecast horizon of 19 days from the latest observation (target: 2026-11-14), prices are projected to rise by 2.62% to approximately 251.59 INR/kg, evaluated at high confidence (9/10 evidence points). Overall risk is classified as MEDIUM, driven primarily by moderate return volatility: weekly return standard deviation is 1.40%. Procurement planning should factor in supplier delivery lead times to mitigate potential cost escalation.",
      "totalObservations": 22,
      "dataFreshnessDays": 4
    }
  ],
  "summary": {
    "totalMaterialsAnalyzed": 3,
    "highRiskMaterials": 1,
    "mediumRiskMaterials": 1,
    "lowRiskMaterials": 1,
    "upwardTrendMaterials": 2,
    "downwardTrendMaterials": 0,
    "stableTrendMaterials": 1
  },
  "warnings": []
}
```

---

### 2.2. `POST /api/agents/market-price/analyze-all`
Runs historical analysis and time-series forecasting across every material available in the active catalog (all 9 materials).

#### Request Body
```json
{
  "analysisDate": "2026-10-30",
  "predictionHorizonDays": 30
}
```

#### Successful Response (`200 OK`)
Returns `MaterialPriceAnalysisResponse` containing 9 material results and a consolidated risk breakdown.

---

### 2.3. `POST /api/agents/market-price/monitor`
Performs periodic surveillance across all commodities, detecting price spikes, volatility anomalies, rapid inflation, and unverified data.

#### Request Body
```json
{
  "analysisDate": "2026-10-30",
  "lookbackDays": 30,
  "predictionHorizonDays": 15
}
```

#### Successful Response (`200 OK`)
```json
{
  "success": true,
  "agent": "market_price_agent",
  "analysisDate": "2026-10-30",
  "lookbackDays": 30,
  "predictionHorizonDays": 15,
  "alertsGenerated": 1,
  "resolvedAlertsCount": 0,
  "alerts": [
    {
      "alertId": "ALT-3-HIGH_VOLATILITY-0001",
      "alertType": "HIGH_VOLATILITY",
      "severity": "WARNING",
      "materialId": 3,
      "materialName": "Buttons",
      "message": "Elevated price volatility: Weekly return volatility is 2.55% (threshold: 2.0%).",
      "metricValue": 2.55,
      "threshold": 2.0,
      "status": "ACTIVE",
      "timestamp": "2026-10-30 17:50:00",
      "resolvedAt": null
    }
  ],
  "alertHistory": [
    {
      "alertId": "ALT-3-HIGH_VOLATILITY-0001",
      "alertType": "HIGH_VOLATILITY",
      "severity": "WARNING",
      "materialId": 3,
      "materialName": "Buttons",
      "message": "Elevated price volatility: Weekly return volatility is 2.55% (threshold: 2.0%).",
      "metricValue": 2.55,
      "threshold": 2.0,
      "status": "ACTIVE",
      "timestamp": "2026-10-30 17:50:00",
      "resolvedAt": null
    }
  ],
  "results": [ ... ],
  "summary": {
    "totalMaterialsAnalyzed": 9,
    "highRiskMaterials": 1,
    "mediumRiskMaterials": 4,
    "lowRiskMaterials": 4,
    "upwardTrendMaterials": 6,
    "downwardTrendMaterials": 1,
    "stableTrendMaterials": 2,
    "totalAlerts": 1,
    "activeAlertsCount": 1,
    "resolvedAlertsCount": 0,
    "totalHistoricalAlerts": 1
  },
  "marketOverview": "Periodic market price monitoring evaluated 9 raw materials across the active catalog. Currently, 1 material (Buttons) is classified at HIGH risk due to weekly return volatility and step surges, 4 at MEDIUM risk, and 4 at LOW risk..."
}
```

---

### 2.4. `GET /api/agents/market-price/datasets`
Inspects and describes all available Excel datasets in `LoomPilot Datasets/`.

#### Successful Response (`200 OK`)
```json
{
  "success": true,
  "datasetDirectory": "C:\\Users\\...\\LoomPilot Datasets",
  "totalDatasetsDiscovered": 15,
  "primaryMarketDataset": "LoomPilot_MarketPrices.xlsx",
  "datasets": [
    {
      "filename": "LoomPilot_MarketPrices.xlsx",
      "sheets": [
        {
          "sheetName": "MarketPrices",
          "rowCount": 198,
          "columnCount": 6,
          "columns": ["PriceObservationID", "MaterialID", "ObservationDate", "UnitPriceINR", "PriceSource", "VerificationStatus"]
        }
      ],
      "isRelevantToAgent": true,
      "description": "Primary time-series dataset containing weekly raw material market prices."
    }
  ],
  "totalMaterialsAvailable": 9,
  "totalObservations": 198,
  "dateRange": {
    "startDate": "2026-06-01",
    "endDate": "2026-10-26"
  },
  "dataQualitySummary": {
    "verifiedObservations": 180,
    "pendingReviewObservations": 18,
    "samplingFrequency": "Weekly (every 7 days)",
    "warnings": []
  }
}
```

---

### 2.5. `GET /api/agents/market-price/health`
Returns health check and Groq LLM integration status without exposing credentials.

#### Successful Response (`200 OK`)
```json
{
  "status": "healthy",
  "agent": "market_price_agent",
  "version": "1.0.0",
  "datasetsLoaded": true,
  "datasetPath": "C:\\Users\\...\\LoomPilot Datasets",
  "totalMaterials": 9,
  "totalObservations": 198,
  "groqConfigured": true,
  "groqConnected": false,
  "groqModel": "llama-3.3-70b-versatile"
}
```

---

## 3. Feasibility AI Agent Endpoints

### 3.1. `POST /api/agents/feasibility/evaluate`
Performs end-to-end manufacturing feasibility evaluation for a submitted client order across materials, machines, workforce, commitments, and schedules.

#### Request Body
| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `tenantId` | `string` | No | Tenant identifier (default: `"tenant_default"`) |
| `orderId` | `Union[int, str]` | Optional* | Order ID or Number (e.g. `21`, `"ORD-021"`) |
| `overrideAnalysisDate` | `string (YYYY-MM-DD)` | No | Historical cutoff date simulation (e.g. `"2026-10-20"`) |
| `customOrder` | `object` | Optional* | Custom order simulation if evaluating an unbooked order |

*Either `orderId` or `customOrder` must be provided.

```json
{
  "tenantId": "tenant_default",
  "orderId": "ORD-021",
  "overrideAnalysisDate": "2026-10-20"
}
```

#### Successful Response (`200 OK`)
```json
{
  "orderId": 21,
  "orderNumber": "ORD-021",
  "productName": "Cotton Polo T-Shirt",
  "orderQuantity": 800,
  "orderDeliveryDate": "2026-11-05",
  "tenantId": "tenant_default",
  "evaluatedAt": "2026-10-31T08:50:00",
  "status": "CONDITIONALLY_FEASIBLE",
  "summary": "Order ORD-021 is CONDITIONALLY FEASIBLE. Production completion is achievable by 2026-10-29...",
  "earliestFeasibleDeliveryDate": "2026-10-30",
  "delayDays": 0,
  "criticalPathBottleneck": "Raw Material Procurement (Cotton Fabric)",
  "checks": {
    "material": {
      "status": "WARNING",
      "requiredKg": 294.0,
      "availableKg": 120.0,
      "shortageKg": 174.0,
      "earliestAvailableDate": "2026-10-24"
    },
    "machine": {
      "status": "PASS",
      "stages": []
    },
    "workforce": {
      "status": "PASS",
      "headcountAvailable": 25,
      "attendanceRate": 0.901
    },
    "commitments": {
      "status": "WARNING",
      "activeOrdersCount": 15
    },
    "productionSchedule": {
      "totalProductionDays": 4,
      "estimatedStartDate": "2026-10-25",
      "estimatedCompletionDate": "2026-10-29",
      "earliestFeasibleDeliveryDate": "2026-10-30",
      "requestedDeliveryDate": "2026-11-05",
      "delayDays": 0
    }
  },
  "issues": [
    {
      "issueId": "MAT-SHORT-1",
      "title": "Raw Material Shortage: Cotton Fabric",
      "severity": "HIGH",
      "affectedResource": "Cotton Fabric",
      "actualAvailable": 120.0,
      "required": 294.0,
      "shortage": 174.0,
      "explanation": "Current unreserved stock has only 120.00 kg vs required 294.00 kg.",
      "businessImpact": "Production cannot commence until replenishment finishes.",
      "recommendedSolution": "Place immediate purchase order with South Loom Supplies.",
      "estimatedTimeToResolveDays": 4,
      "requiresApproval": true
    }
  ],
  "recommendations": [],
  "alternativeScenarios": [
    {
      "scenarioId": "SCEN-01",
      "name": "Expedited Material Procurement",
      "description": "Engage alternate local vendor for faster delivery.",
      "proposedChanges": "Reduce procurement lead time from 4 to 2 days.",
      "feasibilityStatus": "FEASIBLE",
      "expectedCompletionDate": "2026-10-27",
      "expectedDeliveryDate": "2026-10-28",
      "delayDays": 0,
      "tradeoffs": "Higher freight costs may apply.",
      "requiresAdminApproval": true
    }
  ],
  "executiveExplanation": "Factory Leadership Summary: Order ORD-021 can be manufactured on time provided cotton fabric purchase order is issued immediately..."
}
```

### 3.2. `GET /api/agents/feasibility/orders`
Lists available manufacturing orders from `LoomPilot_Orders.xlsx` with current status and metrics.

#### Query Parameters
- `tenantId` (`string`, optional): Defaults to `"tenant_default"`.
- `limit` (`integer`, optional): Max orders to return (default: `50`).

### 3.3. `GET /api/agents/feasibility/health`
Returns health check and catalog counts for the Feasibility Agent.

#### Response (`200 OK`)
```json
{
  "status": "healthy",
  "agent": "feasibility_agent",
  "version": "1.0.0",
  "datasetsLoaded": true,
  "totalOrders": 30,
  "totalProducts": 6,
  "totalMachines": 12,
  "totalEmployees": 32,
  "groqConfigured": true,
  "groqConnected": false,
  "groqModel": "llama-3.3-70b-versatile"
}
```

---

## 4. cURL Request Examples

### 4.1. Market Price Agent Examples

### Analyze Materials
```bash
curl -X POST "http://localhost:8000/api/agents/market-price/analyze" \
     -H "Content-Type: application/json" \
     -d '{
       "materialIds": [1, 2, 7],
       "predictionHorizonDays": 15
     }'
```

### Analyze All Catalog Materials
```bash
curl -X POST "http://localhost:8000/api/agents/market-price/analyze-all" \
     -H "Content-Type: application/json" \
     -d '{
       "predictionHorizonDays": 30
     }'
```

### Periodic Market Monitoring
```bash
curl -X POST "http://localhost:8000/api/agents/market-price/monitor" \
     -H "Content-Type: application/json" \
     -d '{
       "lookbackDays": 30
     }'
```

### Dataset Information
```bash
curl -X GET "http://localhost:8000/api/agents/market-price/datasets"
```

### Health Check
```bash
curl -X GET "http://localhost:8000/api/agents/market-price/health"
```

---

### 4.2. Feasibility AI Agent Examples

### Evaluate Order Feasibility
```bash
curl -X POST "http://localhost:8000/api/agents/feasibility/evaluate" \
     -H "Content-Type: application/json" \
     -d '{
       "tenantId": "tenant_default",
       "orderId": "ORD-021"
     }'
```

### Evaluate Order with Historical Cutoff Date
```bash
curl -X POST "http://localhost:8000/api/agents/feasibility/evaluate" \
     -H "Content-Type: application/json" \
     -d '{
       "tenantId": "tenant_default",
       "orderId": 21,
       "overrideAnalysisDate": "2026-10-20"
     }'
```

### Evaluate Custom Order (Simulation)
```bash
curl -X POST "http://localhost:8000/api/agents/feasibility/evaluate" \
     -H "Content-Type: application/json" \
     -d '{
       "tenantId": "tenant_default",
       "customOrder": {
         "orderNumber": "SIM-999",
         "productName": "Cotton Polo T-Shirt",
         "orderQuantity": 500,
         "requestedDeliveryDate": "2026-11-15"
       }
     }'
```

### List Available Orders
```bash
curl -X GET "http://localhost:8000/api/agents/feasibility/orders?limit=15"
```

### Feasibility Health Check
```bash
curl -X GET "http://localhost:8000/api/agents/feasibility/health"
```


