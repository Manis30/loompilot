# LoomPilot Backend Status Report (Generated)

**Generated At:** `2026-10-30T12:15:23.830Z`  
**Monorepo:** pnpm workspace (`apps/api`, `packages/shared`, `packages/agents-client`, `apps/web`)  
**TypeScript Typecheck:** Passing (0 errors)  
**Architectural Decoupling (`depcruise`):** Passing (0 violations across 122 modules, 346 dependencies)  

---

## 1. Domain & Platform Models (`apps/api/src/models`)

Total Model Files: **22**

| # | Model File Path |
| :---: | :--- |
| 1 | `catalog/machine.model.ts` |
| 2 | `catalog/market-price.model.ts` |
| 3 | `catalog/material.model.ts` |
| 4 | `catalog/product.model.ts` |
| 5 | `identity/client.model.ts` |
| 6 | `identity/settings.model.ts` |
| 7 | `identity/supplier.model.ts` |
| 8 | `identity/user.model.ts` |
| 9 | `interaction/agent-run.model.ts` |
| 10 | `interaction/conversation.model.ts` |
| 11 | `orders/order.model.ts` |
| 12 | `platform/audit-log.model.ts` |
| 13 | `platform/counter.model.ts` |
| 14 | `platform/file.model.ts` |
| 15 | `platform/idempotency-key.model.ts` |
| 16 | `platform/import-job.model.ts` |
| 17 | `platform/notification.model.ts` |
| 18 | `platform/outbox-message.model.ts` |
| 19 | `platform/refresh-token.model.ts` |
| 20 | `production/maintenance-ticket.model.ts` |
| 21 | `production/stock-movement.model.ts` |
| 22 | `production/supervisor-daily-report.model.ts` |

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

Total Repositories: **10**

| # | Repository |
| :---: | :--- |
| 1 | `admin-costing.repository.ts` |
| 2 | `audit-log.repository.ts` |
| 3 | `base.repository.ts` |
| 4 | `client-account.repository.ts` |
| 5 | `idempotency.repository.ts` |
| 6 | `orders.repository.ts` |
| 7 | `refresh-token.repository.ts` |
| 8 | `settings.repository.ts` |
| 9 | `unit-of-work.ts` |
| 10 | `user.repository.ts` |

---

## 4. Test Suite Summary (`apps/api/test`)

Total Test Files: **28**  
Total Test Declarations: **141**

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
| `models/paise-validation.test.ts` | 4 |
| `models/partial-indexes.test.ts` | 6 |
| `models/ref-types.test.ts` | 2 |
| `models/schema-indexes.test.ts` | 11 |
| `models/schema-v4-rules.test.ts` | 17 |
| `repositories/base-repository.test.ts` | 7 |
| `repositories/orders-repository.test.ts` | 8 |
| `repositories/unit-of-work.test.ts` | 7 |
| `routes/health.test.ts` | 6 |
| `scripts/create-admin.test.ts` | 1 |
| `utils/dates.test.ts` | 7 |
| `utils/logger.test.ts` | 5 |
| `utils/money.test.ts` | 11 |
| `utils/pagination.test.ts` | 4 |

---
