# LoomPilot Dataset Analysis & Market Price Agent Specification

## 1. Executive Summary

This document provides a comprehensive structural, statistical, and operational analysis of all Excel datasets stored in the `loompilot_ai/LoomPilot Datasets/` directory.

The analysis is conducted to determine the exact data landscape available for the **Market Price Agent** of the **LoomPilot** AI-powered textile and garment manufacturing management platform.

### Core Findings:
- **15 Excel Files** discovered in `LoomPilot Datasets/`.
- **Primary Operational Market Dataset**: `LoomPilot_MarketPrices.xlsx` contains 198 actual historical market price observations across 9 distinct raw materials over 22 consecutive weeks (2026-06-01 to 2026-10-26).
- **Master Material Catalog**: `LoomPilot_Materials.xlsx` defines 9 raw materials (Cotton Fabric, Polyester Thread, Buttons, Zippers, Packaging Bags, Printed Labels, Linen Fabric, Elastic Tape, Packaging Cartons) with baseline rates, current inventory levels, units, and supplier links.
- **Supplier Directory**: `LoomPilot_Suppliers.xlsx` contains 9 textile suppliers with city locations and lead time days.
- **Synthetic/Demo Dataset Identified**: `priceObservations_dummy_data.xlsx` is explicitly labeled in its internal README sheet as synthetic demo data for a MongoDB schema test (`MAT_01`, `MAT_02`, `MAT_03`). In accordance with core instructions, this file is documented but **not** used as real operational ground truth.
- **Contracted/Locked Order Costs**: `LoomPilot_OrderMaterials.xlsx` contains fixed cost rates at order booking time. These are locked accounting costs and are **not** dynamic market spot prices.

---

## 2. Inventory of All Available Datasets

| File Name | Primary Sheet | Rows | Columns | Relevance to Market Price Agent |
| :--- | :--- | :--- | :--- | :--- |
| **`LoomPilot_MarketPrices.xlsx`** | `MarketPrices` | 198 | 6 | **Primary**: Historical market price time-series |
| **`LoomPilot_Materials.xlsx`** | `Materials` | 9 | 6 | **Primary**: Material master metadata, stock, units |
| **`LoomPilot_Suppliers.xlsx`** | `Suppliers` | 9 | 4 | **Primary**: Preferred supplier details & lead times |
| **`LoomPilot_OrderMaterials.xlsx`** | `OrderMaterials` | 90 | 6 | **Reference**: Locked procurement rates per order |
| **`LoomPilot_Orders.xlsx`** | `Orders` | 30 | 14 | **Reference**: Manufacturing order timeline & volumes |
| **`LoomPilot_Quotations.xlsx`** | `Quotations` | 30 | 9 | **Reference**: Quoted prices & target profit margins |
| **`LoomPilot_Products.xlsx`** | `Products` | 7 | 4 | **Reference**: Bill-of-materials fabric requirements |
| **`priceObservations_dummy_data.xlsx`** | `priceObservations` / `README` | 540 | 9 | **Demo**: Synthetic test data (non-operational) |
| **`LoomPilot_Attendance.xlsx`** | `Attendance` | 2772 | 6 | Non-price: Worker attendance and shifts |
| **`LoomPilot_Clients.xlsx`** | `Clients` | 9 | 4 | Non-price: Customer directory |
| **`LoomPilot_Employees.xlsx`** | `Employees` | 21 | 5 | Non-price: Factory staffing |
| **`LoomPilot_Machines.xlsx`** | `Machines` | 12 | 6 | Non-price: Machine capacity & process areas |
| **`LoomPilot_MachineStatus.xlsx`** | `MachineStatus` | 60 | 5 | Non-price: Machine availability log |
| **`LoomPilot_ProductionReports.xlsx`** | `ProductionReports` | 111 | 8 | Non-price: Daily stage production & defects |
| **`LoomPilot_Supervisors.xlsx`** | `Supervisors` | 3 | 4 | Non-price: Supervisor assignments |

---

## 3. In-Depth Analysis of Relevant Datasets

### 3.1. `LoomPilot_MarketPrices.xlsx` (Primary Time-Series Data)

#### A. Schema & Data Types
| Column Name | Excel Data Type | Pandas Dtype | Description |
| :--- | :--- | :--- | :--- |
| `PriceObservationID` | Numeric Integer | `int64` | Primary key identifier for the price observation (1 to 198) |
| `MaterialID` | Numeric Integer | `int64` | Foreign key referencing `LoomPilot_Materials.xlsx` (1 to 9) |
| `ObservationDate` | Date / Timestamp | `datetime64[ns]` | Date of weekly market price snapshot (2026-06-01 to 2026-10-26) |
| `UnitPriceINR` | Floating Decimal | `float64` | Market unit price in Indian Rupees (INR) |
| `PriceSource` | Text String | `object` | Source of price quote ("Supplier quotation / sample market feed") |
| `VerificationStatus`| Text String | `object` | Verification state: `Verified` (180 rows) or `Pending Review` (18 rows) |

#### B. Observation Dates and Sampling Frequency
- **Date Range**: `2026-06-01` to `2026-10-26` (22 weeks, 147 calendar days).
- **Sampling Frequency**: Strictly weekly (every 7 days, on Mondays).
  - List of 22 dates: `2026-06-01`, `2026-06-08`, `2026-06-15`, `2026-06-22`, `2026-06-29`, `2026-07-06`, `2026-07-13`, `2026-07-20`, `2026-07-27`, `2026-08-03`, `2026-08-10`, `2026-08-17`, `2026-08-24`, `2026-08-31`, `2026-09-07`, `2026-09-14`, `2026-09-21`, `2026-09-28`, `2026-10-05`, `2026-10-12`, `2026-10-19`, `2026-10-26`.
- **Completeness**: Exactly 22 observations for each of the 9 materials ($9 \times 22 = 198$ rows).
- **Missing Values**: 0 nulls across all columns.
- **Duplicates**: 0 duplicate `(MaterialID, ObservationDate)` pairs.

#### C. Statistical Profile by Material
| ID | Material Name | Unit | Catalog Rate | Initial Price (2026-06-01) | Latest Price (2026-10-26) | Min Price | Max Price | Net Movement (%) | Volatility (CV %) | Trend Type |
| :-: | :--- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :--- |
| **1** | Cotton Fabric | kg | 185.00 | 182.00 | **245.16** | 182.00 | 245.16 | **+34.70%** | 8.77% | Sustained Upward |
| **2** | Polyester Thread | cone | 72.00 | 73.28 | **93.06** | 71.95 | 93.33 | **+26.99%** | 8.07% | Sustained Upward |
| **3** | Buttons | piece | 1.80 | 1.84 | **2.39** | 1.79 | 2.39 | **+29.89%** | 8.20% | Sustained Upward |
| **4** | Zippers | piece | 8.50 | 8.64 | **11.14** | 8.55 | 11.14 | **+28.94%** | 8.27% | Sustained Upward |
| **5** | Packaging Bags | piece | 2.25 | 2.25 | **2.93** | 2.25 | 2.93 | **+30.22%** | 8.21% | Sustained Upward |
| **6** | Printed Labels | piece | 0.90 | 0.88 | **1.17** | 0.88 | 1.17 | **+32.95%** | 8.53% | Sustained Upward |
| **7** | Linen Fabric | kg | 245.00 | 247.41 | **241.41** | 241.33 | 248.64 | **-2.43%** | 1.10% | Slightly Downward / Stable |
| **8** | Elastic Tape | meter | 18.00 | 18.27 | **17.91** | 17.73 | 18.27 | **-1.97%** | 1.07% | Stable |
| **9** | Packaging Cartons | piece| 12.00 | 12.07 | **12.11** | 11.82 | 12.18 | **+0.33%** | 1.00% | Highly Stable |

#### D. Data Quality and Caveats
1. **Verification Status**:
   - Materials 1 through 6 have 100% `Verified` status.
   - Materials 7, 8, and 9 have 6 observations each marked `Pending Review` (specifically observations on 2026-06-01, 2026-06-29, 2026-07-27, 2026-08-24, 2026-09-21, 2026-10-19).
   - *Impact*: The risk analyzer must incorporate `VerificationStatus` as an uncertainty risk factor.
2. **Weekly Observation Frequency**:
   - The data is sampled on a weekly cadence (7-day delta). When calculating daily rates of change or projecting 7, 15, and 30-day predictions, the time delta must explicitly reflect the weekly periodicity ($\Delta t = 7\text{ days}$).

---

### 3.2. `LoomPilot_Materials.xlsx` (Material Catalog)

#### A. Schema & Content
| MaterialID | MaterialName | Unit | CurrentStock | CurrentUnitRateINR | PreferredSupplierID |
| :-: | :--- | :-: | :-: | :-: | :-: |
| 1 | Cotton Fabric | kg | 1,250 | 185.00 | 1 |
| 2 | Polyester Thread | cone | 210 | 72.00 | 2 |
| 3 | Buttons | piece | 8,500 | 1.80 | 3 |
| 4 | Zippers | piece | 2,400 | 8.50 | 4 |
| 5 | Packaging Bags | piece | 3,200 | 2.25 | 5 |
| 6 | Printed Labels | piece | 6,000 | 0.90 | 6 |
| 7 | Linen Fabric | kg | 860 | 245.00 | 7 |
| 8 | Elastic Tape | meter | 1,250 | 18.00 | 8 |
| 9 | Packaging Cartons | piece | 2,200 | 12.00 | 9 |

#### B. Crucial Insight: Catalog Rate vs. Current Market Price
- The `CurrentUnitRateINR` column represents the internal standard or baseline procurement rate established at the start of the manufacturing cycle (June 2026).
- By October 26, 2026, the actual market price for Cotton Fabric has inflated from 182.00 to 245.16 INR/kg (+34.7%), while `CurrentUnitRateINR` in the master table remains at 185.00 INR/kg.
- **Business Implication**: If the factory quotes manufacturing orders based on the catalog rate (185.00) instead of the latest market price (245.16), the company incurs a significant gross margin erosion of ~60.16 INR/kg. The Market Price Agent provides vital protection against this cost mismatch.

---

### 3.3. `LoomPilot_Suppliers.xlsx` (Supplier Directory)

| SupplierID | SupplierName | City | LeadTimeDays |
| :-: | :--- | :--- | :-: |
| 1 | South Loom Supplies | Coimbatore | 4 |
| 2 | ThreadLine Traders | Tiruppur | 2 |
| 3 | ButtonHub | Chennai | 3 |
| 4 | ZipWorks | Bengaluru | 3 |
| 5 | PackRight | Hosur | 2 |
| 6 | LabelCraft | Chennai | 3 |
| 7 | Cedar Textile Supply | Erode | 5 |
| 8 | Metro Threads & Trims | Tiruppur | 3 |
| 9 | Evergreen Fabric House | Salem | 6 |

- Supplier IDs directly correspond to `PreferredSupplierID` in `LoomPilot_Materials.xlsx`.
- Lead times range from 2 to 6 days, which informs procurement planning horizons.

---

### 3.4. `LoomPilot_OrderMaterials.xlsx` (Locked Order Costs)

- 90 rows of material line items mapped to Orders 1 to 30.
- Columns: `OrderMaterialID`, `OrderID`, `MaterialID`, `RequiredQuantity`, `UnitRateINR`, `EstimatedCostINR`.
- **Critical Distinction**: The `UnitRateINR` in this table is the contracted procurement price locked at the time of order placement.
- In accordance with project instructions: *"Do not treat locked procurement prices as historical market prices."* These values are kept separate from dynamic market price analysis.

---

### 3.5. `priceObservations_dummy_data.xlsx` (Synthetic Demo Data)

- Internal `README` sheet states:
  > *"Purpose: Synthetic demo data for LoomPilot priceObservations collection. Records: 540 total rows; 180 observations per material (MAT_01 Organic Cotton Yarn 40s; MAT_02 Polyester Yarn 30D; MAT_03 Cotton Fabric 60s). Important: Do not use this dummy dataset for real quotations, procurement, or business decisions."*
- **Role in Market Price Agent**: This file is retained without modification. The agent engine loads real operational data from `LoomPilot_MarketPrices.xlsx`. However, the agent's material resolver is engineered to also recognize string IDs like `"MAT_01"` or `"1"` and map them smoothly.

---

## 4. Analytical Methodology for Market Price Agent

### 4.1. Historical Metrics Calculation
1. **Latest Price ($P_t$)**: Price at the most recent observation date $t$.
2. **Previous Price ($P_{t-1}$)**: Price at the immediately preceding observation date $t-1$.
3. **Daily Equivalent Change ($\Delta P_{\text{daily}}$)**:
   $$\Delta P_{\text{daily}} = \frac{P_t - P_{t-1}}{\Delta t}$$
   where $\Delta t$ is the calendar days between observations (typically 7 days for weekly data).
4. **Daily Equivalent Percentage Change ($\% \Delta P_{\text{daily}}$)**:
   $$\% \Delta P_{\text{daily}} = \frac{P_t - P_{t-1}}{P_{t-1} \times \Delta t} \times 100$$
5. **Moving Averages**:
   - 7-day average: Last observation or average of points within last 7 calendar days.
   - 30-day average: Average of observations within the last 30 calendar days (last ~4-5 weekly observations).
6. **Monthly Price Movement**:
   $$\Delta P_{\text{30-day}} = P_t - P_{t - 30\text{d}}$$
7. **Volatility ($CV$)**:
   $$\text{CV} = \frac{\sigma}{\mu} \times 100$$
   where $\sigma$ is standard deviation and $\mu$ is the mean price over the observed period.

### 4.2. Forecasting Engine
Given 22 weekly observations per material:
1. **Holt's Linear Exponential Smoothing**:
   $$\ell_t = \alpha P_t + (1 - \alpha)(\ell_{t-1} + b_{t-1})$$
   $$b_t = \beta (\ell_t - \ell_{t-1}) + (1 - \beta)b_{t-1}$$
   $$\hat{P}_{t+h} = \ell_t + h \cdot b_t$$
   where $h = \frac{\text{Horizon Days}}{7}$.
2. **Ordinary Least Squares (OLS) Linear Trend Model**:
   Serves as an ensemble validator and baseline:
   $$P_t = \beta_0 + \beta_1 t + \epsilon_t$$
3. **Prediction Interval & Confidence Score**:
   - Residual standard error $s_e = \sqrt{\frac{\sum (P_i - \hat{P}_i)^2}{N - 2}}$.
   - $95\%$ Prediction interval: $\hat{P} \pm t_{critical} \cdot s_e \sqrt{1 + \frac{1}{N} + \frac{(t_h - \bar{t})^2}{\sum (t_i - \bar{t})^2}}$.
   - Confidence levels (`HIGH`, `MEDIUM`, `LOW`) derived from sample size, model goodness-of-fit ($R^2$), historical volatility ($CV$), and data freshness.

### 4.3. Risk Classification Logic
- **LOW**: Historical $CV < 3.0\%$, forecasted change $< 2.0\%$, data fresh, fully verified.
- **MEDIUM**: Historical $CV \in [3.0\%, 7.0\%]$ or forecasted change $\in [2.0\%, 5.0\%]$.
- **HIGH**: Historical $CV \ge 7.0\%$, or recent sharp surge $> 3\%$, or forecasted price increase $> 5\%$, or unverified data with high volatility.
- All threshold values are defined in `app/core/config.py` for full configurability.

---

## 5. Verification & Integrity Confirmation

- All original Excel files in `LoomPilot Datasets/` have been preserved without modification.
- No synthetic records or artificial prices have been inserted into real business files.
- The Market Price Agent reads directly from `LoomPilot_MarketPrices.xlsx`, `LoomPilot_Materials.xlsx`, and `LoomPilot_Suppliers.xlsx`.

