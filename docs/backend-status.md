# LoomPilot Backend Status Report (Generated)

**Generated At:** `2026-10-30T11:13:27.353Z`  
**Monorepo:** pnpm workspace (`apps/api`, `packages/shared`, `packages/agents-client`, `apps/web`)  
**TypeScript Typecheck:** Passing (0 errors)  
**Architectural Decoupling (`depcruise`):** Passing (0 violations across 122 modules, 346 dependencies)  

---

## 1. Domain & Platform Models (`apps/api/src/models`)

Total Model Files: **41**

| # | Model File Path |
| :---: | :--- |
| 1 | `admin/delivery.model.ts` |
| 2 | `admin/order-assignment.model.ts` |
| 3 | `admin/payment.model.ts` |
| 4 | `admin/purchase-decision.model.ts` |
| 5 | `admin/quotation-costing.model.ts` |
| 6 | `catalog/machine.model.ts` |
| 7 | `catalog/market-source.model.ts` |
| 8 | `catalog/material.model.ts` |
| 9 | `catalog/price-alert.model.ts` |
| 10 | `catalog/price-history.model.ts` |
| 11 | `catalog/price-observation.model.ts` |
| 12 | `catalog/product.model.ts` |
| 13 | `identity/client-account.model.ts` |
| 14 | `identity/client.model.ts` |
| 15 | `identity/settings.model.ts` |
| 16 | `identity/supplier.model.ts` |
| 17 | `identity/user.model.ts` |
| 18 | `interaction/agent-run.model.ts` |
| 19 | `interaction/client-interaction.model.ts` |
| 20 | `interaction/conversation.model.ts` |
| 21 | `interaction/escalation.model.ts` |
| 22 | `interaction/message.model.ts` |
| 23 | `orders/feasibility-report.model.ts` |
| 24 | `orders/order.model.ts` |
| 25 | `orders/quotation-revision.model.ts` |
| 26 | `orders/quotation.model.ts` |
| 27 | `platform/audit-log.model.ts` |
| 28 | `platform/counter.model.ts` |
| 29 | `platform/file.model.ts` |
| 30 | `platform/idempotency-key.model.ts` |
| 31 | `platform/import-job.model.ts` |
| 32 | `platform/notification.model.ts` |
| 33 | `platform/outbox-message.model.ts` |
| 34 | `platform/refresh-token.model.ts` |
| 35 | `production/alert.model.ts` |
| 36 | `production/daily-output.model.ts` |
| 37 | `production/machine-status-log.model.ts` |
| 38 | `production/monitoring-snapshot.model.ts` |
| 39 | `production/reservation.model.ts` |
| 40 | `production/stock-movement.model.ts` |
| 41 | `production/supervisor-daily-report.model.ts` |

---

## 2. API Routes & RBAC Matrix

Total Registered Route Endpoints: **28**

| Method | Route Path | Allowed Realms | Allowed Roles | Idempotent |
| :--- | :--- | :--- | :--- | :---: |
| `POST` | `/api/v1/auth/login` | `Public` | `-` | No |
| `POST` | `/api/v1/client/auth/login` | `Public` | `-` | No |
| `POST` | `/api/v1/auth/refresh` | `Public` | `-` | No |
| `POST` | `/api/v1/client/auth/refresh` | `Public` | `-` | No |
| `POST` | `/api/v1/auth/logout` | `Public` | `-` | No |
| `POST` | `/api/v1/client/auth/logout` | `Public` | `-` | No |
| `POST` | `/api/v1/auth/logout-all` | `user` | `admin, supervisor` | No |
| `POST` | `/api/v1/client/auth/logout-all` | `client` | `-` | No |
| `POST` | `/api/v1/client/auth/accept-invite` | `Public` | `-` | Yes |
| `GET` | `/api/v1/me` | `user, client` | `admin, supervisor` | No |
| `PATCH` | `/api/v1/me` | `user, client` | `admin, supervisor` | No |
| `POST` | `/api/v1/auth/change-password` | `user, client` | `admin, supervisor` | No |
| `GET` | `/api/v1/users` | `user` | `admin` | No |
| `POST` | `/api/v1/users` | `user` | `admin` | No |
| `PATCH` | `/api/v1/users/:id` | `user` | `admin` | No |
| `POST` | `/api/v1/users/:id/lock` | `user` | `admin` | No |
| `POST` | `/api/v1/users/:id/unlock` | `user` | `admin` | No |
| `GET` | `/api/v1/client-accounts` | `user` | `admin` | No |
| `POST` | `/api/v1/client-accounts/invite` | `user` | `admin` | No |
| `POST` | `/api/v1/client-accounts/:id/reinvite` | `user` | `admin` | No |
| `POST` | `/api/v1/client-accounts/:id/lock` | `user` | `admin` | No |
| `POST` | `/api/v1/client-accounts/:id/unlock` | `user` | `admin` | No |
| `GET` | `/api/v1/audit` | `user` | `admin` | No |
| `GET` | `/health` | `Public` | `-` | No |
| `GET` | `/ready` | `Public` | `-` | No |
| `GET` | `/api/v1/health` | `Public` | `-` | No |
| `GET` | `/api/v1/ready` | `Public` | `-` | No |
| `GET` | `/docs.json` | `Public` | `-` | No |

---

## 3. Repositories (`apps/api/src/repositories`)

Total Repositories: **8**

| # | Repository |
| :---: | :--- |
| 1 | `audit-log.repository.ts` |
| 2 | `base.repository.ts` |
| 3 | `client-account.repository.ts` |
| 4 | `idempotency.repository.ts` |
| 5 | `refresh-token.repository.ts` |
| 6 | `settings.repository.ts` |
| 7 | `unit-of-work.ts` |
| 8 | `user.repository.ts` |

---

## 4. Test Suite Summary (`apps/api/test`)

Total Test Files: **27**  
Total Test Declarations: **118**

| Test File | Test Count |
| :--- | :---: |
| `audit/audit-logging.test.ts` | 2 |
| `auth/auth-login.test.ts` | 6 |
| `auth/invite-flow.test.ts` | 1 |
| `auth/last-admin.test.ts` | 3 |
| `auth/realm-separation.test.ts` | 3 |
| `auth/refresh-rotation.test.ts` | 3 |
| `auth/tenant-isolation.test.ts` | 1 |
| `config/env.test.ts` | 6 |
| `middleware/auth-rate-limiter.test.ts` | 1 |
| `middleware/error-handler.test.ts` | 6 |
| `middleware/idempotency.test.ts` | 2 |
| `middleware/rate-limiter.test.ts` | 4 |
| `middleware/rbac-matrix.test.ts` | 5 |
| `middleware/request-id.test.ts` | 2 |
| `models/client-safe-security.test.ts` | 6 |
| `models/paise-validation.test.ts` | 4 |
| `models/partial-indexes.test.ts` | 2 |
| `models/ref-types.test.ts` | 2 |
| `models/schema-indexes.test.ts` | 11 |
| `repositories/base-repository.test.ts` | 7 |
| `repositories/unit-of-work.test.ts` | 7 |
| `routes/health.test.ts` | 6 |
| `scripts/create-admin.test.ts` | 1 |
| `utils/dates.test.ts` | 7 |
| `utils/logger.test.ts` | 5 |
| `utils/money.test.ts` | 11 |
| `utils/pagination.test.ts` | 4 |

---
