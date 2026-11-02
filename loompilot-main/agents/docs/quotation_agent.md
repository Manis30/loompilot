# LoomPilot Quotation AI Agent: Architecture & Technical Specification

## 1. System Overview

The **Quotation AI Agent** is an enterprise manufacturing financial intelligence service developed for **LoomPilot**, an AI-powered B2B textile and garment manufacturing management platform.

Its primary mission is to protect factory profitability by computing accurate, transparent, and auditable quotations for customer manufacturing orders using **detailed bottom-up costing**.

Instead of relying on top-down guessing or static rules of thumb, the Quotation Agent evaluates the actual physical and operational cost structure of production:
1. **Raw Material Costs**: Dynamic Bill of Materials (BOM) consumption, with validated 5% fabric cutting wastage, priced using real-time market spot rates from the **Market Price Agent**.
2. **Direct Labour Costs**: Stage-specific operational cycle times (Cutting, Stitching, Finishing, Packing) mapped against departmental wage rates.
3. **Machine Operating Costs**: Power consumption, depreciation, and maintenance allocations per machine operating hour based on machine throughput capacities.
4. **Manufacturing Overhead Allocation**: Transparent distribution of factory rent, facility power, supervision, and factory administrative expenses using configured allocation rules.
5. **Additional Production Costs**: Customer-specific customization (special packaging, printing, embroidery, transportation, testing).
6. **Commercial Profit Margin**: Strict support for both **Markup on Production Cost** and **Gross Margin on Selling Price**.
7. **Statutory Taxes**: Transparent Goods and Services Tax (GST) calculations with Central (CGST) and State (SGST) breakdowns.
8. **Executive AI Reasoning**: Business explanations explaining cost drivers, margin rationale, and commercial status powered by **Groq LLM** with deterministic fallbacks.

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        LoomPilot Data Sources                          │
│   (Materials, Products, MarketPrices, Machines, Employees, Clients)    │
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
│                       QuotationAgent Pipeline                          │
│                                                                        │
│   ┌───────────────────────────┐     ┌──────────────────────────────┐   │
│   │    QuotationValidator     │     │      BOMCostingService       │   │
│   │(Tenant, Client, Product)  │     │ (BOM, Wastage, MP Agent Feed)│   │
│   └─────────────┬─────────────┘     └──────────────┬───────────────┘   │
│                 │                                  │                   │
│                 └─────────────────┬────────────────┘                   │
│                                   │                                    │
│                                   ▼                                    │
│   ┌───────────────────────────┐     ┌──────────────────────────────┐   │
│   │   LabourCostingService    │     │    MachineCostingService     │   │
│   │ (Stages, Cycle Times, W/R)│     │(Hours, Power, Depreciation)  │   │
│   └─────────────┬─────────────┘     └──────────────┬───────────────┘   │
│                 │                                  │                   │
│                 └─────────────────┬────────────────┘                   │
│                                   │                                    │
│                                   ▼                                    │
│   ┌───────────────────────────┐     ┌──────────────────────────────┐   │
│   │  OverheadCostingService   │     │        PricingService        │   │
│   │(Rent, Utilities, Admin %) │     │(Markup vs Gross Margin Calc) │   │
│   └─────────────┬─────────────┘     └──────────────┬───────────────┘   │
│                 │                                  │                   │
│                 └─────────────────┬────────────────┘                   │
│                                   │                                    │
│                                   ▼                                    │
│   ┌───────────────────────────┐     ┌──────────────────────────────┐   │
│   │        TaxService         │     │  QuotationExplanationService │   │
│   │ (CGST/SGST/IGST Structure)│     │  (Groq LLM / Deterministic)  │   │
│   └─────────────┬─────────────┘     └──────────────┬───────────────┘   │
│                 │                                  │                   │
│                 └─────────────────┬────────────────┘                   │
│                                   │                                    │
│                                   ▼                                    │
│                     ┌───────────────────────────┐                      │
│                     │    QuotationRepository    │                      │
│                     │ (Status Lifecycle Store)  │                      │
│                     └───────────────────────────┘                      │
└───────────────────────────────────┼────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         FastAPI Endpoints                              │
│  POST /api/agents/quotation/generate   GET /api/agents/quotation       │
│  GET  /api/agents/quotation/{id}       POST .../{id}/approve           │
│  POST .../{id}/reject                  GET /api/agents/quotation/health│
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Mathematical Costing Formulations

### 2.1. Bill of Materials & Raw Material Costing
For product $p$ and order quantity $Q$:
$$\text{Gross Required Fabric} = Q \times \text{StandardFabricKgPerUnit} \times (1 + W_{\text{cutting}})$$
where $W_{\text{cutting}} = 0.05$ (5% validated empirical cutting wastage).

For auxiliary materials (thread, packaging, buttons, elastic):
$$\text{Adjusted Material Quantity}_m = Q \times \text{GrossConsumptionPerUnit}_m$$

The unit price $P_m$ is dynamically retrieved from the **Market Price Agent**:
$$\text{Material Cost}_m = \text{Adjusted Material Quantity}_m \times P_m$$
$$\text{Total Direct Material Cost} = \sum_{m \in \text{BOM}} \text{Material Cost}_m$$

*Governance Rule*: If the Market Price Agent feed is unavailable or missing for any item, costing is marked `INCOMPLETE` and the quotation status moves to `PENDING_INFORMATION`. Prices are never fabricated.

### 2.2. Direct Manufacturing Labour Costing
For each operational stage $s \in \{\text{Cutting, Stitching, Finishing, Packing}\}$:
$$\text{Labour Hours}_s = Q \times \text{StandardCycleHoursPerUnit}_s$$
$$\text{Labour Cost}_s = \text{Labour Hours}_s \times \text{HourlyLabourRate}_s$$
$$\text{Total Direct Labour Cost} = \sum_{s} \text{Labour Cost}_s$$

Calibrated standard cycle times (8-hour shift basis):
- **Cutting**: 0.0188 hrs/unit (425 units/shift) @ 120.0 INR/hr
- **Stitching**: 0.0444 hrs/unit (180 units/shift) @ 140.0 INR/hr
- **Finishing**: 0.0267 hrs/unit (300 units/shift) @ 110.0 INR/hr
- **Packing**: 0.0160 hrs/unit (500 units/shift) @ 95.0 INR/hr

### 2.3. Machine Operating Costing
$$\text{Machine Operating Hours}_s = \frac{Q}{\text{ThroughputUnitsPerHour}_s}$$
$$\text{Machine Cost}_s = \text{Machine Operating Hours}_s \times \text{HourlyMachineCost}_s$$
$$\text{Total Machine Operating Cost} = \sum_{s} \text{Machine Cost}_s$$

Calibrated machine rates (power, boiler fuel, lubrication, maintenance):
- **Fabric Cutting Machine (CUT-01/02)**: 85.0 INR/hr
- **Industrial Sewing Machine (ST-01/03)**: 65.0 INR/hr
- **Steam Press & Finishing (FIN-01)**: 95.0 INR/hr
- **Packing Workstation (PK-01)**: 40.0 INR/hr

### 2.4. Manufacturing Overhead Allocation
Under the standard direct manufacturing cost allocation rule:
$$\text{Direct Cost} = \text{Material Cost} + \text{Labour Cost}$$
$$\text{Overhead Cost} = \text{Direct Cost} \times \left(\frac{\text{Overhead Rate \%}}{100}\right)$$

Transparent breakdown:
- Facility & Lease Rent (35%)
- Electricity & Utilities (30%)
- Supervisory & Plant Administration (20%)
- Plant Maintenance & Consumables (15%)

### 2.5. Total Estimated Production Cost
$$\text{Total Production Cost} = \text{Material Cost} + \text{Labour Cost} + \text{Machine Cost} + \text{Overhead Cost} + \text{Additional Costs}$$
$$\text{Production Cost Per Unit} = \frac{\text{Total Production Cost}}{Q}$$

### 2.6. Commercial Selling Price Determination
Strictly differentiates between **Markup** and **Gross Margin**:

1. **Markup on Cost** (`MARKUP`):
   $$\text{Selling Price Before Tax} = \text{Total Production Cost} \times \left(1 + \frac{\text{Markup \%}}{100}\right)$$
   $$\text{Margin Amount} = \text{Selling Price Before Tax} - \text{Total Production Cost}$$

2. **Gross Margin on Selling Price** (`GROSS_MARGIN`):
   $$\text{Selling Price Before Tax} = \frac{\text{Total Production Cost}}{1 - \frac{\text{Gross Margin \%}}{100}}$$
   $$\text{Margin Amount} = \text{Selling Price Before Tax} \times \left(\frac{\text{Gross Margin \%}}{100}\right)$$

### 2.7. Statutory Taxes (GST)
For domestic transactions:
$$\text{CGST Amount} = \text{Selling Price Before Tax} \times \left(\frac{\text{Tax Rate \%}}{200}\right)$$
$$\text{SGST Amount} = \text{Selling Price Before Tax} \times \left(\frac{\text{Tax Rate \%}}{200}\right)$$
$$\text{Final Client Quotation Amount} = \text{Selling Price Before Tax} + \text{CGST Amount} + \text{SGST Amount}$$

---

## 3. Quotation Lifecycle & Status Governance

| Status | Trigger Condition | Permitted Next Actions |
| :--- | :--- | :--- |
| **`DRAFT`** | Initial generation initiated. | System internal state. |
| **`PENDING_INFORMATION`** | Missing BOM recipe, unavailable material spot price, or unconfigured labour/machine rate. | User must supply missing configuration before quotation can be compiled. Cannot be approved. |
| **`PENDING_REVIEW`** | Costing compiled, but price volatility alerts or tight lead times trigger managerial review. | Sales Manager / Plant Admin review and approve. |
| **`READY_FOR_APPROVAL`** | All costing components calculated and complete; verified against active market feeds. | Authorized manager can approve (`/approve`) or reject (`/reject`). |
| **`APPROVED`** | Authorized user records approval with credentials and notes. | Ready for official issuance to client. |
| **`REJECTED`** | Authorized user records rejection with structured reason. | Archived or revised under new quotation request. |
| **`EXPIRED`** | Date exceeds validity date (default 14 calendar days). | Re-quote required with latest market prices. |

*Safety Guardrail*: The AI agent **never automatically approves** quotations or sends quotes to clients without explicit human executive authorization.

---

## 4. REST API Reference

### 4.1. `POST /api/agents/quotation/generate`
Generates a complete bottom-up manufacturing quotation.

**Sample Request:**
```json
{
  "tenantId": "tenant_default",
  "clientId": "CLIENT-001",
  "productName": "Cotton T-Shirt",
  "quantity": 500,
  "pricingMethod": "MARKUP",
  "marginPercentage": 25.0,
  "taxRatePercentage": 5.0,
  "requestedDeliveryDate": "2026-11-20"
}
```

**Sample Response:**
```json
{
  "success": true,
  "agent": "quotation_agent",
  "quotation": {
    "quotationId": "QT-101",
    "quotationNumber": "LP-QT-2026-101",
    "tenantId": "tenant_default",
    "client": {
      "clientId": 1,
      "clientName": "Apex Apparel",
      "city": "Chennai",
      "email": "apex@example.com"
    },
    "productName": "Cotton T-Shirt",
    "quantity": 500,
    "status": "READY_FOR_APPROVAL",
    "costBreakdown": {
      "materials": {
        "status": "COMPLETE",
        "items": [
          {
            "materialName": "Cotton Fabric",
            "requiredQuantity": 275.0,
            "adjustedQuantity": 288.75,
            "unitPrice": 245.16,
            "totalCost": 70789.95,
            "priceSource": "Market Price Agent (Weekly Spot)"
          },
          {
            "materialName": "Polyester Thread",
            "adjustedQuantity": 5.0,
            "unitPrice": 93.06,
            "totalCost": 465.3
          },
          {
            "materialName": "Packaging Bags",
            "adjustedQuantity": 500.0,
            "unitPrice": 2.93,
            "totalCost": 1465.0
          }
        ],
        "totalCost": 72720.25
      },
      "labour": {
        "status": "COMPLETE",
        "totalCost": 6464.5,
        "totalLabourHours": 52.95
      },
      "machine": {
        "status": "COMPLETE",
        "totalCost": 3830.5,
        "totalMachineHours": 52.96
      },
      "overhead": {
        "status": "COMPLETE",
        "totalCost": 7918.48,
        "allocationMethod": "PERCENTAGE_OF_DIRECT_COST"
      },
      "additionalCosts": {
        "status": "COMPLETE",
        "totalCost": 0.0
      }
    },
    "financialSummary": {
      "totalProductionCost": 90933.73,
      "productionCostPerUnit": 181.87,
      "pricingMethod": "MARKUP",
      "marginPercentage": 25.0,
      "sellingPriceBeforeTax": 113667.16,
      "sellingPricePerUnit": 227.33,
      "totalTax": 5683.36,
      "finalQuotationAmount": 119350.52,
      "finalQuotationAmountPerUnit": 238.70
    },
    "explanation": "Manufacturing quotation LP-QT-2026-101 for 500 units of Cotton T-Shirt has been compiled for Apex Apparel..."
  }
}
```

### 4.2. `GET /api/agents/quotation`
Query active quotations with optional `tenantId` and `status` filters.

### 4.3. `GET /api/agents/quotation/{quotationId}`
Retrieve quotation detail with multi-tenant boundary enforcement.

### 4.4. `POST /api/agents/quotation/{quotationId}/approve`
**Payload:**
```json
{
  "authorizedBy": "GeneralManager_Priya",
  "approvalNotes": "Approved for client dispatch."
}
```

### 4.5. `POST /api/agents/quotation/{quotationId}/reject`
**Payload:**
```json
{
  "rejectedBy": "SalesHead_Ramesh",
  "rejectionReason": "Client budget cap exceeded."
}
```

### 4.6. `GET /api/agents/quotation/health`
Health readiness and dataset linkage inspection.

