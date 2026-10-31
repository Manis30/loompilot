# LoomPilot Client Assistant AI Agent: Architecture & Technical Specification

## 1. System Overview

The **Client Assistant AI Agent** is an enterprise B2B sales representative and controlled negotiation intelligence service developed for **LoomPilot**, an AI-powered manufacturing management platform.

Its primary mission is to serve as the customer-facing commercial interface for garment and textile manufacturers:
1. **Intelligent Customer Chat**: Comprehends natural-language customer messages, answers quotation inquiries, explains product specifications, and delivers consultative B2B communication.
2. **Quotation Explanation**: Explains why prices are structured the way they are using actual Bill of Materials (BOM), stage-specific direct labour, machine operating rates, and factory overhead—**without revealing internal confidential costing breakdown or factory margins**.
3. **Controlled Price Bargaining**: Conducts strict, policy-governed price negotiation based on deterministic financial rules. Dynamically enforces authorized representative discretion caps and absolute factory floor prices.
4. **Objection Handling**: Professionally counters commercial objections (price too high, competitor lower quote, lead time reduction, bulk order discounts, credit payment terms, minimum order quantity).
5. **Feasibility-Backed Alternative Recommendations**: When a customer's target price cannot be achieved directly, suggests practical alternatives (order volume tiering, alternative fabric blends, schedule flexibility) validated against real factory capacities using the **Feasibility AI Agent**.
6. **Executive Human Approval Escalation**: Strictly prevents autonomous approval of exceptions breaching factory floor limits or representative discretion, generating auditable approval records for management decision.
7. **Strict Multi-Tenant & Customer Isolation**: Ensures customer conversations and quotations are isolated by tenant and customer ID, preventing cross-customer data exposure.

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        LoomPilot Data Sources                          │
│   (Clients, Quotations, Orders, MarketPrices, Materials, Products)     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         Data Access Layer                              │
│       DataRepository  ───►  QuotationRepository  ───► CustomerService  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     ClientAssistantAgent Pipeline                      │
│                                                                        │
│   ┌───────────────────────────┐     ┌──────────────────────────────┐   │
│   │     CustomerService       │     │       IntentClassifier       │   │
│   │(Verify Client, Ownership) │     │ (10 Intents + Entity Parsing)│   │
│   └─────────────┬─────────────┘     └──────────────┬───────────────┘   │
│                 │                                  │                   │
│                 └─────────────────┬────────────────┘                   │
│                                   │                                    │
│                                   ▼                                    │
│   ┌───────────────────────────┐     ┌──────────────────────────────┐   │
│   │     BargainingService     │     │       ObjectionHandler       │   │
│   │(Floor Price & Discretion) │     │ (Manufacturing Value Drivers)│   │
│   └─────────────┬─────────────┘     └──────────────┬───────────────┘   │
│                 │                                  │                   │
│                 └─────────────────┬────────────────┘                   │
│                                   │                                    │
│                                   ▼                                    │
│   ┌───────────────────────────┐     ┌──────────────────────────────┐   │
│   │    AlternativeService     │     │   ClientAssistantExplService │   │
│   │ (Feasibility Agent Link)  │     │  (Groq LLM / Deterministic)  │   │
│   └─────────────┬─────────────┘     └──────────────┬───────────────┘   │
│                 │                                  │                   │
│                 └─────────────────┬────────────────┘                   │
│                                   │                                    │
│                                   ▼                                    │
│                     ┌───────────────────────────┐                      │
│                     │  ConversationRepository   │                      │
│                     │(Session & Approval Store) │                      │
│                     └───────────────────────────┘                      │
└───────────────────────────────────┼────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         FastAPI Endpoints                              │
│  POST /api/agents/client-assistant/chat                                │
│  GET  /api/agents/client-assistant/conversations/{id}                  │
│  GET  /api/agents/client-assistant/conversations                       │
│  GET  /api/agents/client-assistant/approvals/pending                   │
│  POST /api/agents/client-assistant/approvals/{id}/decide               │
│  POST /api/agents/client-assistant/alternatives                        │
│  GET  /api/agents/client-assistant/health                              │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Mathematical Bargaining & Pricing Rules

All negotiation limits are determined deterministically by commercial business rules and cost calculations—**never by the LLM**.

### 2.1. Minimum Authorized Floor Price Determination
For any quotation with original unit selling price $P_{\text{original}}$ and direct manufacturing cost per unit $C_{\text{prod}}$:
$$P_{\text{floor, cost}} = C_{\text{prod}} \times \left(1 + \frac{\text{FloorMarginPct}}{100}\right)$$
$$P_{\text{floor, discount}} = P_{\text{original}} \times \left(1 - \frac{\text{MaxDiscountPct}}{100}\right)$$
$$P_{\text{minAuthorized}} = \max(P_{\text{floor, cost}}, P_{\text{floor, discount}})$$

*Configured Defaults*:
- $\text{FloorMarginPct} = 8.0\%$ (Guarantees factory operating margin above production costs).
- $\text{MaxDiscountPct} = 12.0\%$ (Caps maximum managerial concession).
- *Example (QT-103 benchmark)*: $P_{\text{original}} = \text{₹}250.00$, $C_{\text{prod}} = \text{₹}215.00$. Authorized floor price is calibrated at **₹235.00 per unit**.

### 2.2. Representative Autonomous Discretion Limit
Sales representatives (and the AI agent acting autonomously) are restricted by account tier:
| Customer Account Tier | Qualification Threshold | Discretionary Concession Limit | Standard Payment Terms |
| :--- | :--- | :--- | :--- |
| **Platinum Key Account** | Lifetime spend $\ge \text{₹}500,000$ or $\ge 3$ orders | Up to **6.0%** discount | Net 45 |
| **Gold Partner** | Lifetime spend $\ge \text{₹}250,000$ or $\ge 2$ orders | Up to **4.5%** discount | Net 30 |
| **Silver Established** | Order count $\ge 1$ | Up to **3.0%** discount | Net 15 |
| **Standard B2B Client** | New / unverified account (0 orders) | Up to **2.0%** discount | 30% Advance, Balance on Delivery |

$$P_{\text{repFloor}} = \max\left(P_{\text{original}} \times \left(1 - \frac{\text{DiscretionaryLimitPct}}{100}\right), P_{\text{minAuthorized}}\right)$$

### 2.3. Counter-Offer Evaluation Logic
When a customer submits a target unit price $P_{\text{target}}$:
1. **$P_{\text{target}} \ge P_{\text{currentOffer}}$**:
   Target satisfies or exceeds active offer. Status moves to `OFFER_MADE` (or `CUSTOMER_ACCEPTED`).
2. **$P_{\text{minAuthorized}} \le P_{\text{target}} < P_{\text{currentOffer}}$**:
   - If discount from original $\le \text{DiscretionaryLimitPct}$: Agent autonomously agrees to $P_{\text{target}}$ (`currentOffer = P_target`, status = `OFFER_MADE`, `requiresApproval = False`).
   - If discount from original $> \text{DiscretionaryLimitPct}$: Representative offers $P_{\text{repFloor}}$ and escalates customer target $P_{\text{target}}$ to Sales Manager (`status = PENDING_APPROVAL`, `requiresApproval = True`).
3. **$P_{\text{target}} < P_{\text{minAuthorized}}$** (Floor Breach):
   - Target price is strictly below the factory's authorized floor price.
   - Agent **cannot and does not accept** $P_{\text{target}}$.
   - Agent proposes $P_{\text{minAuthorized}}$ as its best authorized counter-offer.
   - Escalates customer target to Executive Management (VP/GM) for commercial review (`status = PENDING_APPROVAL`, `requiresApproval = True`).

---

## 3. Negotiation Status Lifecycle

| Status | Trigger Condition | Permitted Next Actions |
| :--- | :--- | :--- |
| **`INITIAL`** | Conversation initialized; initial quotation presented. | Customer query or counter-offer. |
| **`IN_PROGRESS`** | Customer asking questions or discussing commercial terms. | Bargaining, objection handling. |
| **`OFFER_MADE`** | Agent has proposed a revised unit price within authorized limits. | Customer acceptance, counter-offer, rejection. |
| **`COUNTER_OFFER_RECEIVED`** | Customer submitted explicit counter-price. | Bargaining evaluation. |
| **`PENDING_APPROVAL`** | Concession exceeds autonomous allowance or is below floor price. | Human manager decision (`/approvals/{id}/decide`). |
| **`APPROVED`** | Manager officially approves pricing exception. | Agent notifies customer of approved rate. |
| **`REJECTED`** | Manager declines exception request. | Agent offers closest authorized floor rate. |
| **`CUSTOMER_ACCEPTED`** | Customer confirms acceptance of active offer. | Finalization and order execution. |
| **`CUSTOMER_DECLINED`** | Customer terminates negotiation. | Archived negotiation record. |
| **`CLOSED`** | Order formalized or negotiation concluded. | Final state. |

*Safety Guardrail*: Deals are **never marked finalized** merely because a customer expresses preliminary interest.

---

## 4. REST API Reference

### 4.1. `POST /api/agents/client-assistant/chat`
Process incoming customer natural-language messages, conduct controlled bargaining, handle objections, and generate executive B2B responses.

**Request Payload:**
```json
{
  "tenantId": "tenant_default",
  "customerId": 4,
  "quotationId": "QT-103",
  "conversationId": "CONV-001",
  "message": "Your quotation is expensive. Can you reduce the price?"
}
```

**Response Payload:**
```json
{
  "success": true,
  "agent": "client_assistant_agent",
  "conversationId": "CONV-001",
  "customerId": 4,
  "quotationId": "QT-103",
  "intent": "DISCOUNT_REQUEST",
  "negotiationStatus": "OFFER_MADE",
  "originalPricePerUnit": 250.0,
  "currentOfferPerUnit": 235.0,
  "customerTargetPrice": null,
  "minimumAuthorizedPrice": 235.0,
  "requiresApproval": false,
  "pendingApprovalId": null,
  "response": "Thank you for your feedback regarding the quotation for Cotton T-Shirt. We appreciate your partnership with LoomPilot. To support UrbanThread Fashion, we are pleased to offer a revised rate of ₹235.00 per unit (down from our initial quote of ₹250.00). This pricing reflects our high-grade raw material standards, precision stitching, and complete export-grade packaging.",
  "timestamp": "2026-10-31T14:50:23.984381",
  "suggestedAlternatives": null
}
```

---

### 4.2. `GET /api/agents/client-assistant/conversations/{conversationId}`
Retrieve complete conversation thread with message history and negotiation summary.

**Sample Response:**
```json
{
  "success": true,
  "agent": "client_assistant_agent",
  "conversationId": "CONV-001",
  "tenantId": "tenant_default",
  "customerId": 4,
  "quotationId": "QT-103",
  "negotiationStatus": "OFFER_MADE",
  "originalPricePerUnit": 250.0,
  "currentOfferPerUnit": 235.0,
  "customerTargetPrice": null,
  "minimumAuthorizedPrice": 235.0,
  "requiresApproval": false,
  "pendingApprovalId": null,
  "messageCount": 2,
  "messages": [
    {
      "messageId": "MSG-0001",
      "sender": "CUSTOMER",
      "message": "Your quotation is expensive. Can you reduce the price?",
      "intent": "DISCOUNT_REQUEST",
      "timestamp": "2026-10-31T14:50:23.900000",
      "metadata": {}
    },
    {
      "messageId": "MSG-0002",
      "sender": "AGENT",
      "message": "Thank you for your feedback regarding the quotation for Cotton T-Shirt...",
      "intent": "DISCOUNT_REQUEST",
      "timestamp": "2026-10-31T14:50:23.984000",
      "metadata": {
        "currentOfferPerUnit": 235.0,
        "negotiationStatus": "OFFER_MADE",
        "requiresApproval": false
      }
    }
  ],
  "negotiationSummary": {
    "concessionPercentage": 6.0
  }
}
```

---

### 4.3. `GET /api/agents/client-assistant/approvals/pending`
List active managerial approval requests requiring human authorization.

**Sample Response:**
```json
{
  "success": true,
  "agent": "client_assistant_agent",
  "totalCount": 1,
  "pendingApprovals": [
    {
      "approvalId": "APP-001",
      "conversationId": "CONV-001",
      "tenantId": "tenant_default",
      "customerId": 4,
      "quotationId": "QT-103",
      "requestedPricePerUnit": 225.0,
      "originalPricePerUnit": 250.0,
      "minimumAuthorizedPrice": 235.0,
      "requestedDiscountPct": 10.0,
      "reason": "Customer requested unit price ₹225.00 (10.0% discount) is strictly below minimum authorized selling price ₹235.00.",
      "status": "PENDING",
      "createdTimestamp": "2026-10-31T14:50:34.631000"
    }
  ]
}
```

---

### 4.4. `POST /api/agents/client-assistant/approvals/{approvalId}/decide`
Record authorized manager decision on an escalated negotiation exception.

**Request Payload:**
```json
{
  "tenantId": "tenant_default",
  "authorizedBy": "GeneralManager_Priya",
  "decision": "APPROVE",
  "approvedPricePerUnit": 225.0,
  "notes": "Approved for high-volume annual account retention."
}
```

**Response Payload:**
```json
{
  "success": true,
  "agent": "client_assistant_agent",
  "approvalId": "APP-001",
  "conversationId": "CONV-001",
  "quotationId": "QT-103",
  "status": "APPROVED",
  "decision": "APPROVE",
  "decidedBy": "GeneralManager_Priya",
  "effectivePricePerUnit": 225.0,
  "message": "Approval 'APP-001' successfully APPROVED by 'GeneralManager_Priya'.",
  "timestamp": "2026-10-31T14:50:40.120000"
}
```

---

### 4.5. `POST /api/agents/client-assistant/alternatives`
Generate grounded alternatives validated with the **Feasibility AI Agent**.

**Request Payload:**
```json
{
  "tenantId": "tenant_default",
  "customerId": 4,
  "quotationId": "QT-103",
  "targetPricePerUnit": 225.0
}
```

**Response Payload:**
```json
{
  "success": true,
  "agent": "client_assistant_agent",
  "quotationId": "QT-103",
  "originalPricePerUnit": 250.0,
  "targetPricePerUnit": 225.0,
  "alternatives": [
    {
      "type": "VOLUME_TIER",
      "title": "Bulk Volume Scaling (1,500 units)",
      "description": "Increase order volume from 1,000 to 1,500 units to amortize cutting table setup, printing screens, and machine calibration costs.",
      "proposedPricePerUnit": 237.5,
      "savingsPerUnitINR": 12.5,
      "tradeOff": "Requires committing to 1,500 units (+500 units).",
      "feasible": true,
      "feasibilityNotes": "Production capacity verified across 4 stages. Estimated machine time: 105.9 hours."
    },
    {
      "type": "ALTERNATIVE_FABRIC",
      "title": "Cotton-Poly Commercial Blend (60/40)",
      "description": "Substitute 100% pure combed single jersey with a certified 60/40 Cotton-Polyester blend. Maintains soft hand-feel, enhanced dimensional stability, and lower yarn cost.",
      "proposedPricePerUnit": 230.0,
      "savingsPerUnitINR": 20.0,
      "tradeOff": "Slightly different hand-feel compared to 100% pure organic cotton.",
      "feasible": true,
      "feasibilityNotes": "Material stock and supplier lead times verified by Feasibility Agent."
    },
    {
      "type": "SCHEDULE_FLEXIBILITY",
      "title": "Flexible Production Schedule (21 Days Lead Time)",
      "description": "Allow an extended production window of 21 days (standard +7 days). Enables routing through regular off-peak production shifts, eliminating overtime wage surcharges.",
      "proposedPricePerUnit": 242.5,
      "savingsPerUnitINR": 7.5,
      "tradeOff": "Lead time extended from 14 to 21 calendar days.",
      "feasible": true,
      "feasibilityNotes": "Standard shift availability confirmed across all stages."
    }
  ]
}
```

---

### 4.6. `GET /api/agents/client-assistant/health`
Health readiness and configuration inspection.

---

## 5. Security & Multi-Tenant Isolation

1. **Tenant Isolation**: Conversations, quotations, and approvals are strictly bound to `tenantId`. Mismatched tenant IDs trigger HTTP 403 Forbidden.
2. **Customer Ownership Enforcement**: A customer cannot negotiate, inspect, or modify another customer's quotation. Violations raise `CustomerOwnershipError` (HTTP 403 Forbidden).
3. **Internal Cost Confidentiality**: Factory floor margins, exact BOM unit costs, machine operating hourly rates, and minimum floor prices are strictly excluded from all customer-facing messages.
4. **Deterministic Authority**: The LLM never decides selling prices, discounts, or approvals; all calculations are executed in deterministic Python services.

---

## 6. Postman & cURL Testing Instructions

### Step 1: Health Check
```bash
curl -X GET "http://localhost:8000/api/agents/client-assistant/health"
```

### Step 2: Initial Customer Discount Query
```bash
curl -X POST "http://localhost:8000/api/agents/client-assistant/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "tenant_default",
    "customerId": 4,
    "quotationId": "QT-103",
    "conversationId": "CONV-001",
    "message": "Your quotation is expensive. Can you reduce the price?"
  }'
```

### Step 3: Counter-Offer Below Floor (Triggers Escalation)
```bash
curl -X POST "http://localhost:8000/api/agents/client-assistant/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "tenant_default",
    "customerId": 4,
    "quotationId": "QT-103",
    "conversationId": "CONV-001",
    "message": "Can you do ₹225 per unit?"
  }'
```

### Step 4: Check Pending Approvals
```bash
curl -X GET "http://localhost:8000/api/agents/client-assistant/approvals/pending?tenantId=tenant_default"
```

### Step 5: Executive Manager Approval
```bash
curl -X POST "http://localhost:8000/api/agents/client-assistant/approvals/APP-001/decide" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "tenant_default",
    "authorizedBy": "GeneralManager_Priya",
    "decision": "APPROVE",
    "approvedPricePerUnit": 225.0,
    "notes": "Approved for annual key account partnership."
  }'
```

### Step 6: Verify Conversation State
```bash
curl -X GET "http://localhost:8000/api/agents/client-assistant/conversations/CONV-001?tenantId=tenant_default"
```

