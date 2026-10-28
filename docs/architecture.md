# LoomPilot System Architecture

## 1. System Vision
LoomPilot is a specialised AI advisory platform designed for textile manufacturing operations. It provides intelligent guidance throughout the order lifecycle:
1. **Quotation Stage**: Translating unstructured customer enquiries into precise, itemised quotations accounting for on-hand inventory, raw material purchase lead times, price-risk volatility, wastage, and worker output capabilities.
2. **Monitoring Stage**: Continuous comparison of shop-floor daily output against planned process targets, proactively flagging delays same-day and recommending remediation.
3. **Payment Follow-up Stage**: Post-delivery automated scheduling of payment reminders with human-in-the-loop signoff.

## 2. Advisory Boundaries
To guarantee business safety:
- **No Autonomous Writes to Core State**: Agents never mutate the primary database directly.
- **Proposals Only**: Agents create draft quotations, alerts, and recommendations submitted to the Node API via `/internal/*` endpoints.
- **Pure Python Domain Calculations**: LLMs are never used for arithmetic, scheduling, or cost mathematics. All numbers are computed deterministically in `agents/app/domain` and verified via guardrails.
- **No Autonomous Communications or Purchasing**: Customer quotes, supplier orders, and payment reminders always require human review and authorization.

## 3. High-Level Architecture

```
[ Client: Vite React PWA / Mobile Form ]
                    │
           HTTPS    │ JWT / Cookie Auth
                    ▼
       [ apps/api: Node.js Express ] ◄── (Internal Gateway /internal/*) ──┐
                    │                                                     │
         Read/Write │ Mongoose Session Transactions                       │
                    ▼                                                     │
           [ MongoDB Replica Set ]                                        │
                    ▲                                                     │
          Read-Only │ pymongo (agent_ro)                                  │
                    │                                                     │
         [ agents: FastAPI Python 3.12 ] ─────────────────────────────────┘
                    │
         LLM Client │ (fake / anthropic)
                    ▼
            [ LLM Provider ]
```

## 4. Key Architectural Patterns
- **Monorepo Workspaces**: Managed via pnpm, sharing schemas and types between API and Web clients.
- **Agent Gateway**: Secure internal route group `/internal/*` authenticated via `x-service-token`.
- **Integer Paise Representation**: All monetary figures are stored as integer paise across database schemas and REST payloads, eliminating floating-point errors.
- **Event-Driven Asynchrony**: Daily output entries trigger debounced monitoring sweeps via BullMQ; delivery confirmations trigger immediate payment follow-up creation.
- **Distributed Tracing**: `X-Request-Id` is generated or accepted at the API boundary, forwarded to the Python agents service, and correlated across all structured log statements (Pino and Structlog).

