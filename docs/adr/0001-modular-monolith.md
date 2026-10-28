# ADR 0001: Modular Monolith Architecture for Node.js API

## Status
Accepted

## Context
Textile manufacturing workflows span several tightly coupled operational domains: inventory management, bill of materials (BOM), production processes, workforce scheduling, quality control, customer enquiries, and billing. While domain boundaries exist, deploying microservices introduces unnecessary network latency, distributed transaction overhead, and deployment complexity for small-to-medium manufacturing environments.

## Decision
We adopt a **modular monolith** architecture for the primary backend (`apps/api`):
1. **Vertical Domain Modules**: Each business domain (e.g., `quotations`, `orders`, `materials`, `workforce`, `payments`) resides in a dedicated folder containing its routes, controller, service, Mongoose models, schemas, and tests.
2. **Shared Database & Multi-Tenant Partitioning**: All data is stored in MongoDB, with every document strictly partitioned by `tenantId`.
3. **Database Transactions**: Operations requiring multi-collection consistency (such as Order Confirmation reserving stock and initiating production plans) execute within MongoDB replica-set transactions.
4. **Agent Gateway Subsystem**: A dedicated `/internal/*` route space exists within the monolith, exposing protected ingestion endpoints for agent-generated proposals.

## Consequences
### Positive
- Unified transaction management via MongoDB sessions.
- In-process module communication with zero network hop overhead.
- Simple developer setup and single container deployment for the API.
- Straightforward auditing and consistent request tracing via `X-Request-Id`.

### Negative
- Requires strict coding discipline to prevent cross-module direct database imports (modules should interact via services).

