# ADR 0003: Layered SOLID Architecture with Strict Unidirectional Dependencies

## Status
Accepted

## Context
As LoomPilot's domain logic expanded across Quotation, Monitoring, and Payment Follow-up phases, having feature folders with co-located models, controllers, and services risked circular dependencies, leaky abstractions (e.g. controllers touching database models or services coupled to Express `req`/`res`), and difficult transactional unit testing.

We required a strict layered architecture where each layer has a single responsibility, dependencies flow in only one direction, and unit testing is fast and deterministic using in-memory fake repositories.

## Decision
We refactored `apps/api/src` from feature modules to a strict folder-per-layer architecture:

```
routes -> controllers -> services -> repositories -> models
```

### 1. Layers & Responsibilities
- **`routes/`**: Map HTTP paths and verbs to controller methods and attach middleware (`authMiddleware`, `requireRole`, `validateBody`). No business logic.
- **`controllers/`**: Read HTTP requests, extract parameters and typed `Actor`, invoke exactly one service method, and format the response DTO. They never import models or repositories.
- **`services/`**: Pure business rules, orchestration, event dispatching, and audit logging. Services never import `express`, `req`, `res`, `mongoose`, or database models. They receive an `Actor` (`{ tenantId, userId, role, email }`).
- **`repositories/`**: The exclusive layer that touches Mongoose. Returns plain typed lean entity objects, never active Mongoose documents. Every query is tenant-scoped. Accepts optional `tx?: TxContext` for atomic transactions.
- **`models/`**: Mongoose schemas, indexes, and document typings only.
- **`validators/`**: Request validation schemas using Zod.
- **`mappers/`**: Entity-to-DTO response transformations and role-based field masking (e.g., stripping costs and margins from `STORE` role).
- **`interfaces/`**: Repository contracts, Unit of Work, Notifier, and PDF renderer interfaces.
- **`container.ts`**: The single Composition Root where concrete classes are instantiated and wired together with dependency injection.

### 2. Transaction Management (Unit of Work)
Multi-document database operations (such as quotation confirmation with stock reservation, ledger movement, and production plan creation) are governed by the `IUnitOfWork` interface:
```typescript
await uow.run(async (tx) => {
  await reservationRepo.create({ ... }, tx);
  await movementRepo.record({ ... }, tx);
  await orderRepo.create({ ... }, tx);
});
```
`MongoUnitOfWork` implements this with MongoDB client sessions and `session.withTransaction()`, providing automatic retry on transient errors. In unit tests, `FakeUnitOfWork` allows instant test execution without a database.

### 3. Tooling Enforcement
Architectural boundaries are strictly enforced during CI via `dependency-cruiser` (`apps/api/.dependency-cruiser.cjs`). Any violation (such as a controller importing a model, or a service importing Express) fails `pnpm run lint:deps`.

## Consequences
- **Positive**: Complete decoupling allows 100% pure unit testing of all 14 domain services in milliseconds using in-memory fake repositories.
- **Positive**: Zero coupling to Express or Mongoose inside business logic, making future transport migrations (e.g. gRPC) trivial.
- **Positive**: Strict tenant isolation and role-based field security are enforced at the mapper and service boundary.
