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

## 4. Layered SOLID API Architecture (`apps/api/src`)

The Node.js Express application follows a strict folder-per-layer architecture where dependencies flow in only one direction:

```
routes -> controllers -> services -> repositories -> models
```

### Layer Rules
- **`routes/`**: Defines URL routes, attaches authentication (`authMiddleware`), role-based authorization (`requireRole`), and input validation (`validateBody`). Contains zero business logic.
- **`controllers/`**: Extracts parameters and actor credentials from incoming requests, calls exactly one service method, and maps output to DTOs. Never interacts directly with database models or repositories.
- **`services/`**: Encapsulates all domain orchestration, business rules, event triggers, and audit logging. Takes a decoupled `Actor` context (`{ tenantId, userId, role, email }`) and has zero dependencies on Express or Mongoose.
- **`repositories/`**: The sole layer responsible for Mongoose queries. All queries are strictly tenant-scoped (`tenantId`), return plain typed lean objects, and accept optional transaction contexts (`tx?: TxContext`).
- **`models/`**: Defines Mongoose schemas, compound indexes, and document structures.
- **`container.ts`**: The Composition Root and the only place where concrete classes are instantiated and wired via dependency injection.
- **`mappers/`**: Encapsulates entity-to-DTO transformation and role-based field masking (e.g. hiding costs and margins from the `store` role).
- **`interfaces/`**: Repository contracts, `IUnitOfWork`, `INotifier`, and `IPdfRenderer`.
- **`integrations/`**: Concrete implementations of external systems (`PdfMakeRenderer`, `SmsNotifier`, `WhatsAppNotifier`, `EmailNotifier`).
- **`jobs/`**: Background event queues (`queues.ts`), task processors (`processors.ts`), and periodic sweep schedulers (`scheduler.ts`).

Architectural boundaries are automatically validated during builds and CI with `dependency-cruiser` (`pnpm run lint:deps`).

## 5. Key Architectural Patterns
- **Monorepo Workspaces**: Managed via pnpm, sharing schemas and types between API and Web clients.
- **Agent Gateway**: Secure internal route group `/internal/*` authenticated via constant-time `x-service-token` comparison.
- **Unit of Work Transactions**: Multi-document operations (stock reservation + order confirmation + ledger movements) run inside atomic transactions via `IUnitOfWork` with automatic transient retry.
- **Integer Paise Representation**: All monetary figures are stored as integer paise across database schemas and REST payloads, eliminating floating-point errors.
- **Event-Driven Asynchrony**: Daily output entries trigger debounced monitoring sweeps via BullMQ/in-memory queues; delivery confirmations trigger immediate payment follow-up creation.
- **Distributed Tracing**: `X-Request-Id` is generated or accepted at the API boundary, forwarded to the Python agents service, and correlated across all structured log statements (Pino and Structlog).
