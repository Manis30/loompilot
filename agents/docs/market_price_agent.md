# LoomPilot Market Price Agent: Architecture & Technical Specification

## 1. System Overview

The **Market Price Agent** is a specialized, production-ready AI service engineered for **LoomPilot**, an AI-powered textile and garment manufacturing management platform.

Its primary mission is to protect factory profitability by analyzing historical raw material prices, forecasting future spot rates, evaluating supplier and commodity risks, and generating management-level purchasing advisories before the factory locks client quotations or commits procurement capital.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        LoomPilot Data Sources                          │
│  (LoomPilot_MarketPrices.xlsx, LoomPilot_Materials.xlsx, Suppliers)    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         Data Access Layer                              │
│       ExcelDataLoader  ───►  DataValidator  ───►  DataRepository       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      MarketPriceAgent Pipeline                         │
│                                                                        │
│   ┌─────────────────────┐             ┌─────────────────────┐          │
│   │    PriceAnalyzer    │             │  PredictionEngine   │          │
│   │ (Metrics, Trend, CV)│             │(Holt's Double Exp.) │          │
│   └──────────┬──────────┘             └──────────┬──────────┘          │
│              │                                   │                     │
│              └─────────────────┬─────────────────┘                     │
│                                │                                       │
│                                ▼                                       │
│                     ┌─────────────────────┐                            │
│                     │    RiskAnalyzer     │                            │
│                     │  (LOW, MED, HIGH)   │                            │
│                     └──────────┬──────────┘                            │
│                                │                                       │
│                                ▼                                       │
│                     ┌─────────────────────┐                            │
│                     │RecommendationEngine │                            │
│                     │ (Advisory Guidance) │                            │
│                     └──────────┬──────────┘                            │
│                                │                                       │
│                                ▼                                       │
│                     ┌─────────────────────┐                            │
│                     │ ExplanationService  │                            │
│                     │ (Groq LLM / Rules)  │                            │
│                     └──────────┬──────────┘                            │
└───────────────────────────────────┼────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                            FastAPI Layer                               │
│  POST /analyze | POST /analyze-all | POST /monitor | GET /datasets     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Architectural Components

### 2.1. Data Access Layer
- **`ExcelDataLoader`**: Provides safe, read-only access to all underlying Excel datasets (`LoomPilot_MarketPrices.xlsx`, `LoomPilot_Materials.xlsx`, `LoomPilot_Suppliers.xlsx`, etc.). Preserves original Excel files without altering or overwriting content.
- **`DataValidator`**: Validates schema integrity, data types, chronologically sorts observations, detects non-positive prices, and removes duplicates.
- **`DataRepository`**: Encapsulates all query operations. Provides flexible identifier resolution (supporting integer IDs e.g. `1`, string IDs `"1"`, code conventions `"MAT_01"`, and material names e.g. `"Cotton Fabric"`).

### 2.2. Numerical Analysis Engines
All calculations are performed deterministically in Python using NumPy and SciPy; LLMs are never asked to calculate financial values.

#### A. Historical Price Analyzer (`PriceAnalyzer`)
For each material $m$ with chronological price series $P = [p_1, p_2, \dots, p_N]$ observed at timestamps $T = [t_1, t_2, \dots, t_N]$:
1. **Latest Price ($P_{\text{latest}}$)**: $p_N$.
2. **Previous Price ($P_{\text{prev}}$)**: $p_{N-1}$.
3. **Step Change & Percentage**:
   $$\Delta P = p_N - p_{N-1}, \quad \% \Delta P = \frac{p_N - p_{N-1}}{p_{N-1}} \times 100$$
4. **Daily Rate of Change**:
   $$\% \Delta P_{\text{daily}} = \frac{\% \Delta P}{\max(1, (t_N - t_{N-1})_{\text{days}})}$$
5. **Moving Averages**:
   - 7-Day Moving Average: $\bar{P}_{\text{7d}} = \frac{1}{|K_{\text{7d}}|} \sum_{i \in K_{\text{7d}}} p_i$, where $t_i \ge t_N - 7\text{ days}$.
   - 30-Day Moving Average: $\bar{P}_{\text{30d}} = \frac{1}{|K_{\text{30d}}|} \sum_{i \in K_{\text{30d}}} p_i$, where $t_i \ge t_N - 30\text{ days}$.
6. **Price-Level Dispersion (Coefficient of Variation - `priceLevelCV` %)**:
   $$\text{priceLevelCV} = \frac{\sigma}{\mu} \times 100 = \frac{\sqrt{\frac{1}{N-1}\sum_{i=1}^N (p_i - \bar{p})^2}}{\bar{p}} \times 100$$
   *Descriptive metric*: Measures total price dispersion over the dataset. A steadily growing commodity will have a high price-level CV even if week-to-week changes are smooth.
7. **Return-Based Volatility (`weeklyReturnVolatility` & `dailyReturnVolatility` %)**:
   Calculated from the series of percentage step returns $r_i = \frac{p_i - p_{i-1}}{p_{i-1}} \times 100$:
   $$\text{weeklyReturnVolatility} = \sqrt{\frac{1}{N-2} \sum_{i=2}^N (r_i - \bar{r})^2}$$
   $$\text{dailyReturnVolatility} = \frac{\text{weeklyReturnVolatility}}{\sqrt{\text{median interval days}}}$$
   *Primary risk metric*: Distinguishes genuine turbulence and price shocks from smooth long-term trends.
8. **Trend Classification**:
   Ordinary Least Squares (OLS) regression over normalized time indices $x = [0, 1, \dots, N-1]$:
   $$\text{Slope } \beta_1 = \frac{\sum (x_i - \bar{x})(p_i - \bar{p})}{\sum (x_i - \bar{x})^2}$$
   - **`UPWARD`**: $\beta_1 > 0$ and total change over series $\ge +2.0\%$.
   - **`DOWNWARD`**: $\beta_1 < 0$ and total change over series $\le -2.0\%$.
   - **`STABLE`**: Absolute change within $\pm 2.0\%$.
9. **Anomaly Detection**:
   Computes $z$-score of the latest step return against historical step returns:
   $$z = \frac{\% \Delta p_N - \mu_{\Delta p}}{\sigma_{\Delta p}}$$
   Triggers `isSuddenSurge` if $z \ge 2.0$ and $\% \Delta p_N \ge 3.0\%$.

#### B. Time-Series Forecasting Engine (`PredictionEngine`)
- **Model**: Double Exponential Smoothing (Holt's Linear Model).
- **Forecast Horizon Handling**:
  The forecasting engine explicitly bridges the temporal gap between the user's `analysisDate` and the dataset's `latestObservationDate`:
  1. `requestedPredictionHorizonDays` ($H_{\text{req}}$): Days forward from `analysisDate`.
  2. `predictionDate` ($T_{\text{target}}$): $\text{analysisDate} + H_{\text{req}}\text{ days}$.
  3. `effectiveForecastHorizonDays` ($H_{\text{eff}}$): $\max(1, (T_{\text{target}} - T_{\text{latest}})_{\text{days}})$.
  4. Number of steps $h = \frac{H_{\text{eff}}}{\text{Median Observation Interval (7 days)}}$.
  When `analysisDate` is 2026-10-30 and `latestObservationDate` is 2026-10-26 with a 15-day horizon, $T_{\text{target}}$ is 2026-11-14, making $H_{\text{eff}} = 19\text{ days}$ ($h = 2.714$ weekly periods).
- **Formulation**:
  - Level update:
    $$\ell_t = \alpha p_t + (1 - \alpha)(\ell_{t-1} + b_{t-1})$$
  - Trend update:
    $$b_t = \beta(\ell_t - \ell_{t-1}) + (1 - \beta)b_{t-1}$$
  - $h$-period ahead forecast:
    $$\hat{p}_{N+h} = \ell_N + h \cdot b_N$$
- **Parameter Optimization**: Grid search across candidate parameter space $\alpha \in [0.1, 0.8], \beta \in [0.05, 0.3]$ minimizing in-sample Sum of Squared Errors (SSE).
- **Prediction Interval**:
  Calculates residual standard error $s_e = \sqrt{\frac{\sum (p_t - \hat{p}_t)^2}{N - 2}}$. For horizon expansion factor $\gamma(h) = \sqrt{1 + h / N}$:
  $$\text{Lower Bound} = \max(0.01, \hat{p}_{N+h} - 1.96 \cdot s_e \cdot \gamma(h))$$
  $$\text{Upper Bound} = \hat{p}_{N+h} + 1.96 \cdot s_e \cdot \gamma(h)$$
- **Transparent Confidence Scoring Breakdown & Model-Fit Safeguard**:
  Every material returns an itemized `confidenceBreakdown` (0–10 scale) backed by holdout validation:
  - **Sample Size Score** (max 3): $N \ge 18 \rightarrow 3$; $N \ge 10 \rightarrow 2$; $N \ge 4 \rightarrow 1$; else $0$.
  - **Model Fit Score** (max 3): Evaluates in-sample MAPE, out-of-sample backtest MAPE, and $R^2$:
    - Score 3: $\text{MAPE} \le 2.5\% \text{ and } R^2 \ge 0.70 \text{ and } \text{backtestMape} \le 3.5\%$
    - Score 2: $\text{MAPE} \le 4.5\% \text{ and } R^2 \ge 0.40 \text{ and } \text{backtestMape} \le 6.0\%$
    - Score 1: $\text{MAPE} \le 8.0\% \text{ and } R^2 \ge 0.20$
    - Score 0: $R^2 < 0.20$ or $\text{MAPE} > 8.0\%$
  - **Volatility Score** (max 2): $\text{weeklyReturnVolatility} \le 1.0\% \rightarrow 2$; $\le 2.0\% \rightarrow 1$; else $0$.
  - **Freshness Score** (max 2): $\text{dataFreshnessDays} \le 7 \rightarrow 2$; $\le 14 \rightarrow 1$; else $0$.
  - **Strict Model-Fit Safeguard**: A very low $R^2$ ($R^2 < 0.35$) automatically triggers `r2SafeguardTriggered = True` and **strictly caps confidence at `MEDIUM` or `LOW`**, preventing models with poor explanatory power from receiving a `HIGH` confidence rating regardless of sample size or data freshness.
  - **Holdout Validation / Backtesting**: For series with $N \ge 8$, the model reserves the last $k = \min(4, \lfloor N/5 \rfloor)$ historical observations for out-of-sample evaluation, calculating `backtestMape` against true prices.
  - **Final Rating**:
    - $\ge 8$ points and not capped by $R^2$ safeguard $\implies$ **`HIGH`**
    - $\ge 5$ points or capped by $R^2$ safeguard $\implies$ **`MEDIUM`**
    - $< 5$ points $\implies$ **`LOW`**
- **Insufficient Data Safeguard**: If $N < 4$ observations, forecasting holds price constant at $p_N$, assigns `LOW` confidence, and issues a data sparsity warning.

#### C. Risk Analyzer & Consistent Policy (`RiskAnalyzer`)
Evaluates risk using return-based volatility and provides a transparent `riskBreakdown` with individual factor `contributions`.
Both `/api/agents/market-price/analyze` and `/api/agents/market-price/monitor` use the **exact same risk scoring policy and thresholds**:
1. **Return Volatility Risk**:
   - `weeklyReturnVolatility` $\ge 2.0\%$ (+3 points, HIGH risk factor).
   - `weeklyReturnVolatility` $\ge 1.0\%$ (+1 point, MEDIUM risk factor).
   - Prevents steadily trending commodities with low return variance from being falsely flagged as high volatility.
2. **Forecasted Cost Escalation Risk**:
   - Projected rise $\ge +4.0\%$ (+3 points).
   - Projected rise $\ge +2.0\%$ (+1 point).
   - Projected drop $\le -2.0\%$ (+1 point for volatility).
3. **Price Velocity**: Sudden surge detected (+2 points); sudden drop (+1 point).
4. **Data Freshness**: Quote older than 14 days (+2 points).
5. **Data Verification**: Observations marked 'Pending Review' / unverified (+1 point).
6. **Sample Size**: Fewer than 6 historical points (+2 points).
- **Classification**:
  - Total score $\ge 4 \implies$ **`HIGH`**
  - Total score $\ge 2 \implies$ **`MEDIUM`**
  - Otherwise $\implies$ **`LOW`**
- Returns structured `contributions` list explaining each score component.

#### D. Alert Management & Lifecycle (`AlertManager`)
The agent incorporates stateful alert lifecycle management:
1. **Threshold Alignment**: Alert triggers align with configured risk settings (`RISK_PRICE_CHANGE_HIGH_THRESHOLD = 3.0%`, `RISK_RETURN_VOLATILITY_HIGH_THRESHOLD = 2.0%`, `RISK_FORECAST_INCREASE_HIGH_THRESHOLD = 4.0%`, `RISK_DATA_STALENESS_DAYS_THRESHOLD = 14`).
2. **Deduplication**: When an alert condition persists across monitoring cycles, the existing active alert is maintained without creating duplicate active entries.
3. **Automatic Resolution**: When market conditions normalize below trigger thresholds, the active alert transitions to `status="RESOLVED"` with a recorded `resolvedAt` timestamp.
4. **Recurrence**: When a previously resolved condition spikes again, a new active alert is generated with a fresh unique ID.
5. **Audit History**: All alert transitions (creation and resolution) are permanently preserved in `alertHistory`.

#### D. Recommendation Engine (`RecommendationEngine`)
Produces contextual, strategic purchasing recommendations based on:
- Risk tier, trend direction, forecasted price change, supplier lead time, and current stock.
- Recommends:
  - *"Consider purchasing required quantities earlier"* when high risk & upward inflation are detected.
  - *"Wait and monitor if prices are declining"* during downward trends.
  - *"Consider purchasing now based on standard production schedule"* during stable periods.
  - *"High price uncertainty: request updated supplier quotations"* during low confidence or sudden volatility.
- **Safety Guarantee**: Recommendations are strictly decision-support advisories; the system never triggers automatic procurement orders.

### 2.3. Groq LLM Integration & Explanation Service
- **Groq Client (`GroqClient`)**: Interacts with Groq API using `llama-3.3-70b-versatile`.
- **Factual Guardrails & Terminology Standards**:
  - LLM receives strictly formatted JSON containing only computed numerical values.
  - Prompt instructions explicitly prohibit describing price-level CV as "annualized volatility"; it must be referred to as "price-level dispersion" or "historical variation".
  - Return volatility is described as "weekly percentage return volatility".
  - The model is forbidden from altering or fabricating numerical metrics.
  - Explanations provide analytical context without repeating the purchasing recommendation verbatim.
- **Graceful Fallback**: If `GROQ_API_KEY` is not configured, or if the API call fails or times out, the `ExplanationService` generates a deterministic template-based explanation grounded in the calculated numbers adhering to the exact same terminology standards.

---

## 3. Operational Scenarios

### Scenario A: Material Price Analysis for a New Order
When a factory customer requests a manufacturing quotation for a style (e.g. 5,000 Cotton T-Shirts):
1. The client sends `POST /api/agents/market-price/analyze` with `materialIds: [1, 2, 5]` (Cotton Fabric, Polyester Thread, Packaging Bags) and `predictionHorizonDays: 15`.
2. The agent resolves the material metadata, computes current vs. historical prices, projects prices for the 15-day procurement horizon, evaluates risks, and advises whether to lock orders immediately.
3. Factory estimators use the `predictedPrice` (e.g. 251.59 INR/kg for Cotton) rather than outdated catalog rates (185.00 INR/kg), protecting profit margins.

### Scenario B: Periodic Market Price Monitoring
Factory supervisors trigger weekly monitoring via `POST /api/agents/market-price/monitor`:
1. The agent scans all 9 raw materials across the factory catalog.
2. Identifies commodities experiencing price surges, high volatility ($CV \ge 7.0\%$), rapid inflation forecasts ($\ge +4.0\%$), and unverified supplier records.
3. Issues structured alerts (`PRICE_SURGE`, `HIGH_VOLATILITY`, `RAPID_COST_INFLATION`, `STALE_QUOTATION`) and compiles an executive summary.

---

## 4. Dataset Insights & Business Grounding

The LoomPilot actual datasets exhibit clear real-world textile dynamics:
- **Materials 1–6** (Cotton Fabric, Polyester Thread, Buttons, Zippers, Packaging Bags, Printed Labels): Exhibited steady upward inflation (+26% to +34% over 22 weeks) with historical volatility $CV \approx 8.0\% - 8.9\%$.
- **Materials 7–8** (Linen Fabric, Elastic Tape): Exhibited price stability with slight softening (-1.9% to -2.4%) and low volatility ($CV \approx 1.1\%$).
- **Material 9** (Packaging Cartons): Highly stable (+0.33% change, $CV \approx 1.0\%$).
- **Catalog Rate Discrepancy**: Cotton Fabric master catalog listed a baseline rate of 185.00 INR/kg, while actual spot market prices reached 245.16 INR/kg on October 26, 2026. This underlines the necessity of the Market Price Agent.

