# LoomPilot Feasibility AI Agent: Architecture & Technical Specification

## 1. System Overview

The **Feasibility AI Agent** is an enterprise manufacturing intelligence service developed for **LoomPilot**, an AI-powered textile and garment production management system.

Its core objective is to evaluate whether a newly submitted or existing manufacturing client order can be successfully produced and delivered within the customer's requested deadline, considering real-world factory floor constraints.

The agent assesses:
- **Product BOM & Material Requirements**: Standard product recipes with a validated 5% fabric cutting allowance.
- **Warehouse Inventory & Commitments**: Unallocated stock vs dynamic reservations from active in-progress orders.
- **Supplier Lead Times & Procurement**: Sourcing missing materials from preferred vendors with guaranteed lead time modeling.
- **Machine Availability & Maintenance**: Line capacities across Cutting, Stitching, Finishing, and Packing, accounting for offline equipment and alternative machine routing.
- **Workforce Headcount & Attendance**: Skills-based department staffing with empirical attendance rates (~90.1%) under designated supervisors.
- **Process Sequencing & Production Scheduling**: Strict dependency flow calculating the **earliest feasible delivery date** and schedule variance.
- **User-Friendly Natural-Language Reasoning**: Explaining constraints, business impacts, and actionable solutions in plain business language powered by **Groq LLM** with deterministic fallbacks.
- **Alternative Mitigation Scenarios**: Presenting actionable scenarios (delivery date extensions, multi-machine parallel routing, overtime shifts, and expedited procurement).

---

## 2. Architecture & Pipeline

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        LoomPilot Data Sources                          │
│  (Orders, Products, Materials, Suppliers, Machines, Attendance, etc.)  │
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
│                     FeasibilityAgent Pipeline                          │
│                                                                        │
│   ┌───────────────────────────┐     ┌──────────────────────────────┐   │
│   │ MaterialFeasibilityEval   │     │    MachineFeasibilityEval    │   │
│   │(BOM, Wastage, Lead Times) │     │ (Capacities, Downtime, Line) │   │
│   └─────────────┬─────────────┘     └──────────────┬───────────────┘   │
│                 │                                  │                   │
│                 └─────────────────┬────────────────┘                   │
│                                   │                                    │
│                                   ▼                                    │
│   ┌───────────────────────────┐     ┌──────────────────────────────┐   │
│   │  WorkforceFeasibilityEval │     │     CommitmentEvaluator      │   │
│   │ (Skills, Attendance, Hrs) │     │  (WIP Backlog & Reservations)│   │
│   └─────────────┬─────────────┘     └──────────────┬───────────────┘   │
│                 │                                  │                   │
│                 └─────────────────┬────────────────┘                   │
│                                   │                                    │
│                                   ▼                                    │
│                     ┌───────────────────────────┐                      │
│                     │    ProductionScheduler    │                      │
│                     │(Earliest Date, Bottleneck)│                      │
│                     └─────────────┬─────────────┘                      │
│                                   │                                    │
│                                   ▼                                    │
│                     ┌───────────────────────────┐                      │
│                     │ FeasibilityScenarioEngine │                      │
│                     │(Overtime, Parallel, Ext.) │                      │
│                     └─────────────┬─────────────┘                      │
│                                   │                                    │
│                                   ▼                                    │
│                     ┌───────────────────────────┐                      │
│                     │FeasibilityExplanationServ │                      │
│                     │ (Groq LLM / Deterministic)│                      │
│                     └─────────────┬─────────────┘                      │
└───────────────────────────────────┼────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         REST API Controller                            │
│           POST /api/agents/feasibility/evaluate                        │
│           GET  /api/agents/feasibility/health                          │
│           GET  /api/agents/feasibility/orders                          │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Operational Logic & Mathematical Formulations

### 3.1. Bill of Materials (BOM) & Material Requirements
For any product $p$ and order quantity $Q$:
$$\text{Gross Required Fabric} = Q \times \text{StandardFabricKgPerUnit} \times (1 + W_{\text{cutting}})$$
where $W_{\text{cutting}} = 0.05$ (5.0% validated empirical cutting wastage rate).

For auxiliary materials (thread, packaging, trims):
$$\text{Required Quantity} = Q \times \text{GrossConsumptionPerUnit}$$

### 3.2. Committed Stock & Dynamic Reservations
Committed inventory across all other active in-progress orders $\mathcal{O}_{\text{active}}$ is dynamically calculated to prevent double-counting:
$$\text{CommittedStock}_m = \sum_{o \in \mathcal{O}_{\text{active}}} \text{RemainingQuantity}_o \times \text{ConsumptionRate}_{p_o, m}$$

$$\text{NetAvailableStock}_m = \text{CurrentStock}_m - \text{CommittedStock}_m$$

$$\text{Shortage}_m = \max(0, \text{GrossRequired}_m - \max(0, \text{NetAvailableStock}_m))$$

If $\text{Shortage}_m > 0$, material availability is determined by the supplier lead time:
$$t_{\text{avail}} = t_{\text{eval}} + \max_{m \in \text{Shortages}}(\text{LeadTimeDays}_m)$$

### 3.3. Machine Feasibility & Bottleneck Identification
Each manufacturing stage $s \in \{\text{Cutting, Stitching, Finishing, Packing}\}$ has available capacity:
$$\text{StageCapacity}_s = \sum_{m \in \text{AvailableMachines}_s} \text{CapacityUnitsPerDay}_m$$
$$\text{StageDuration}_s = \left\lceil \frac{Q}{\text{AllocatedMachineCapacity}_s} \right\rceil$$

The process bottleneck is the stage requiring the longest single-line duration:
$$\text{BottleneckStage} = \arg\max_{s} (\text{StageDuration}_s)$$
In LoomPilot's factory setup, Stitching is the primary line bottleneck (e.g. ST-01 has 180 units/day, while Cutting has 450 units/day).

### 3.4. Production Timeline & Earliest Feasible Delivery Date
The manufacturing schedule respects strict sequential process dependencies:
1. **Material Procurement**: Duration = $\max(\text{LeadTimeDays})$ if shortages exist; 0 if in stock.
2. **Cutting**: Duration = $\lceil Q / \text{Cap}_{\text{cutting}} \rceil$.
3. **Stitching**: Duration = $\lceil Q / \text{Cap}_{\text{stitching}} \rceil$.
4. **Finishing**: Duration = $\lceil Q / \text{Cap}_{\text{finishing}} \rceil$.
5. **Packing**: Duration = $\lceil Q / \text{Cap}_{\text{packing}} \rceil$.
6. **Quality & Defect Buffer**: 1 operating day (factoring empirical 1.57% historical defect rate).
7. **Dispatch Staging Buffer**: 1 calendar day.

$$\text{ProductionStartDate} = \max(t_{\text{eval}}, t_{\text{avail}})$$
$$\text{ProductionCompletionDate} = \text{ProductionStartDate} + \sum_{s} \text{StageDuration}_s$$
$$\text{EarliestFeasibleDeliveryDate} = \text{ProductionCompletionDate} + \text{BufferDays}$$
$$\text{DelayDays} = \max(0, (\text{EarliestFeasibleDeliveryDate} - \text{RequestedDeliveryDate}))$$

---

## 4. Feasibility Classification Contract

| Status | Operational Criteria |
| :--- | :--- |
| **`FEASIBLE`** | All required raw materials are in stock, allocated machines are operational, adequate workforce is available, and `DelayDays == 0`. |
| **`CONDITIONALLY_FEASIBLE`** | Order is achievable if corrective or operational actions are taken: material procurement with supplier lead time, delivery date adjustment, alternative machine routing, or scheduled overtime. |
| **`NOT_FEASIBLE`** | Hard physical impossibility prevents fulfillment: zero available machines in a required process area, or order volume exceeding physical factory capacity within reasonable horizons (e.g. delay > 90 days). |
| **`NEEDS_INFORMATION`** | Critical master data is absent (e.g., missing Bill of Materials, unmapped product ID). The earliest delivery date is returned as `null` with explicit explanations. |

---

## 5. REST API Endpoints

### 5.1. `POST /api/agents/feasibility/evaluate`
Evaluates the manufacturing feasibility of an existing order or a newly simulated client order.

**Request Payload:**
```json
{
  "tenantId": "tenant_default",
  "orderId": "ORD-001",
  "orderQuantity": 500,
  "requiredDeliveryDate": "2026-11-20",
  "evaluationDate": "2026-10-30",
  "includeMarketPriceRisk": false
}
```

**Response Payload:**
```json
{
  "success": true,
  "agent": "feasibility_agent",
  "tenantId": "tenant_default",
  "orderId": "ORD-001",
  "orderNumber": "LP-2026-001",
  "productName": "Cotton T-Shirt",
  "orderQuantity": 500,
  "assessmentStatus": "CONDITIONALLY_FEASIBLE",
  "requestedDeliveryDate": "2026-11-20",
  "estimatedProductionStartDate": "2026-11-03",
  "estimatedProductionCompletionDate": "2026-11-11",
  "earliestFeasibleDeliveryDate": "2026-11-13",
  "delayDays": 0,
  "confidence": "MEDIUM",
  "summary": "Order LP-2026-001 can be completed...",
  "checks": {
    "material": { ... },
    "machine": { ... },
    "workforce": { ... },
    "existingOrders": { ... },
    "productionSchedule": { ... }
  },
  "issues": [ ... ],
  "recommendations": [ ... ],
  "alternativeScenarios": [ ... ],
  "dataLimitations": [ ... ],
  "explanation": "..."
}
```

### 5.2. `GET /api/agents/feasibility/health`
Returns agent readiness, dataset loading confirmation, and inventory metrics.

### 5.3. `GET /api/agents/feasibility/orders`
Returns active manufacturing orders available for exploratory evaluation.

---

## 6. Safety and Advisory Principles

In strict alignment with manufacturing governance requirements:
- The Feasibility AI Agent is **purely advisory**.
- It **never automatically mutates** orders, warehouse balances, supplier purchase orders, machine states, or worker rosters.
- All corrective interventions (PO releases, overtime shifts, delivery amendments) require explicit **human administrator approval**.

