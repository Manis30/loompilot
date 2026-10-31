# LoomPilot Backend Status Report (Generated)

**Generated At:** `2026-10-31T15:02:54.657Z`  
**Monorepo:** pnpm workspace (`apps/api`, `packages/shared`, `packages/agents-client`, `apps/web`)  
**TypeScript Typecheck:** Passing (0 errors)  
**Architectural Decoupling (`depcruise`):** Passing (0 violations across 178 modules, 636 dependencies)  

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

Total Registered Route Endpoints: **96**

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
| `GET` | `/api/v1/users/:id` | `user` | `admin` | No |
| `POST` | `/api/v1/users` | `user` | `admin` | No |
| `PATCH` | `/api/v1/users/:id` | `user` | `admin` | No |
| `POST` | `/api/v1/users/:id/lock` | `user` | `admin` | No |
| `POST` | `/api/v1/users/:id/unlock` | `user` | `admin` | No |
| `POST` | `/api/v1/clients/:id/portal/invite` | `user` | `admin` | No |
| `POST` | `/api/v1/clients/:id/portal/re-invite` | `user` | `admin` | No |
| `POST` | `/api/v1/clients/:id/portal/reinvite` | `user` | `admin` | No |
| `POST` | `/api/v1/clients/:id/portal/lock` | `user` | `admin` | No |
| `POST` | `/api/v1/clients/:id/portal/unlock` | `user` | `admin` | No |
| `GET` | `/api/v1/audit` | `user` | `admin` | No |
| `GET` | `/api/v1/settings` | `user` | `admin` | No |
| `PATCH` | `/api/v1/settings` | `user` | `admin` | No |
| `GET` | `/api/v1/clients` | `user` | `admin` | No |
| `POST` | `/api/v1/clients` | `user` | `admin` | No |
| `GET` | `/api/v1/clients/:id` | `user` | `admin` | No |
| `PATCH` | `/api/v1/clients/:id` | `user` | `admin` | No |
| `DELETE` | `/api/v1/clients/:id` | `user` | `admin` | No |
| `GET` | `/api/v1/suppliers` | `user` | `admin` | No |
| `POST` | `/api/v1/suppliers` | `user` | `admin` | No |
| `GET` | `/api/v1/suppliers/:id` | `user` | `admin` | No |
| `PATCH` | `/api/v1/suppliers/:id` | `user` | `admin` | No |
| `DELETE` | `/api/v1/suppliers/:id` | `user` | `admin` | No |
| `GET` | `/api/v1/materials` | `user` | `admin, supervisor` | No |
| `POST` | `/api/v1/materials` | `user` | `admin` | No |
| `GET` | `/api/v1/materials/:id` | `user` | `admin, supervisor` | No |
| `PATCH` | `/api/v1/materials/:id` | `user` | `admin` | No |
| `DELETE` | `/api/v1/materials/:id` | `user` | `admin` | No |
| `POST` | `/api/v1/materials/:id/rate` | `user` | `admin` | No |
| `POST` | `/api/v1/materials/:id/offers` | `user` | `admin` | No |
| `GET` | `/api/v1/machines` | `user` | `admin, supervisor` | No |
| `POST` | `/api/v1/machines` | `user` | `admin` | No |
| `GET` | `/api/v1/machines/:id` | `user` | `admin, supervisor` | No |
| `PATCH` | `/api/v1/machines/:id` | `user` | `admin` | No |
| `DELETE` | `/api/v1/machines/:id` | `user` | `admin` | No |
| `GET` | `/api/v1/products` | `user` | `admin` | No |
| `POST` | `/api/v1/products` | `user` | `admin` | No |
| `GET` | `/api/v1/products/:id` | `user` | `admin` | No |
| `PATCH` | `/api/v1/products/:id` | `user` | `admin` | No |
| `DELETE` | `/api/v1/products/:id` | `user` | `admin` | No |
| `POST` | `/api/v1/products/:id/images` | `user` | `admin` | No |
| `GET` | `/api/v1/client/products` | `client` | `-` | No |
| `GET` | `/api/v1/client/products/:id` | `client` | `-` | No |
| `POST` | `/api/v1/files` | `user, client` | `admin, supervisor` | No |
| `GET` | `/api/v1/files/:id` | `user, client` | `admin, supervisor` | No |
| `POST` | `/api/v1/stock/receipt` | `user` | `admin` | Yes |
| `POST` | `/api/v1/stock/adjust` | `user` | `admin` | No |
| `GET` | `/api/v1/stock/balances` | `user` | `admin` | No |
| `GET` | `/api/v1/stock/movements` | `user` | `admin` | No |
| `POST` | `/api/v1/imports/dry-run` | `user` | `admin` | No |
| `POST` | `/api/v1/imports/commit` | `user` | `admin` | Yes |
| `GET` | `/health` | `Public` | `-` | No |
| `GET` | `/ready` | `Public` | `-` | No |
| `GET` | `/api/v1/health` | `Public` | `-` | No |
| `GET` | `/api/v1/ready` | `Public` | `-` | No |
| `GET` | `/docs.json` | `Public` | `-` | No |
| `POST` | `/api/v1/client/orders` | `client` | `-` | Yes |
| `GET` | `/api/v1/client/orders` | `client` | `-` | No |
| `GET` | `/api/v1/client/orders/:id` | `client` | `-` | No |
| `POST` | `/api/v1/client/orders/:id/quotation/accept` | `client` | `-` | Yes |
| `POST` | `/api/v1/client/orders/:id/quotation/decline` | `client` | `-` | Yes |
| `GET` | `/api/v1/orders` | `user` | `admin, supervisor` | No |
| `GET` | `/api/v1/orders/:id` | `user` | `admin, supervisor` | No |
| `POST` | `/api/v1/orders` | `user` | `admin` | Yes |
| `PATCH` | `/api/v1/orders/:id` | `user` | `admin` | No |
| `POST` | `/api/v1/orders/:id/decide` | `user` | `admin` | No |
| `POST` | `/api/v1/orders/:id/quotation/approve` | `user` | `admin` | Yes |
| `POST` | `/api/v1/orders/:id/quotation/send` | `user` | `admin` | Yes |
| `POST` | `/internal/v1/feasibility-reports` | `Public` | `-` | No |
| `POST` | `/internal/v1/quotation-drafts` | `Public` | `-` | No |
| `POST` | `/internal/v1/quotation-revisions` | `Public` | `-` | No |
| `POST` | `/api/v1/orders/:id/assign` | `user` | `admin` | Yes |
| `POST` | `/api/v1/orders/:id/hold` | `user` | `admin` | Yes |
| `POST` | `/api/v1/orders/:id/resume` | `user` | `admin` | Yes |
| `POST` | `/api/v1/orders/:id/cancel` | `user` | `admin` | Yes |
| `POST` | `/api/v1/orders/:id/ready-for-delivery` | `user` | `admin` | Yes |
| `POST` | `/api/v1/orders/:id/start` | `user` | `admin, supervisor` | Yes |
| `POST` | `/api/v1/orders/:id/payments/create-order` | `client, user` | `admin` | Yes |
| `POST` | `/api/v1/client/orders/:id/payments/:milestoneIndex/razorpay-order` | `client` | `-` | Yes |
| `POST` | `/api/v1/orders/:id/payments/manual-receipt` | `user` | `admin` | Yes |
| `POST` | `/api/v1/orders/:id/payments/reverse` | `user` | `admin` | Yes |
| `POST` | `/api/v1/orders/:id/deliveries` | `user` | `admin` | Yes |
| `POST` | `/webhooks/razorpay` | `Public` | `-` | No |

---

## 3. Repositories (`apps/api/src/repositories`)

Total Repositories: **21**

| # | Repository |
| :---: | :--- |
| 1 | `admin-costing.repository.ts` |
| 2 | `audit-log.repository.ts` |
| 3 | `base.repository.ts` |
| 4 | `client.repository.ts` |
| 5 | `counter.repository.ts` |
| 6 | `file.repository.ts` |
| 7 | `idempotency.repository.ts` |
| 8 | `import-job.repository.ts` |
| 9 | `machine.repository.ts` |
| 10 | `market-price.repository.ts` |
| 11 | `material.repository.ts` |
| 12 | `notification.repository.ts` |
| 13 | `orders.repository.ts` |
| 14 | `outbox.repository.ts` |
| 15 | `product.repository.ts` |
| 16 | `refresh-token.repository.ts` |
| 17 | `settings.repository.ts` |
| 18 | `stock-movement.repository.ts` |
| 19 | `supplier.repository.ts` |
| 20 | `unit-of-work.ts` |
| 21 | `user.repository.ts` |

---

## 4. Test Suite Summary (`apps/api/test`)

Total Test Files: **35**  
Total Test Declarations: **212**

| Test File | Test Count |
| :--- | :---: |
| `audit/audit-logging.test.ts` | 2 |
| `auth/auth-login.test.ts` | 7 |
| `auth/client-portal-security.test.ts` | 3 |
| `auth/forbidden-keys-scan.test.ts` | 7 |
| `auth/invite-flow.test.ts` | 7 |
| `auth/last-admin.test.ts` | 3 |
| `auth/realm-separation.test.ts` | 3 |
| `auth/refresh-rotation.test.ts` | 5 |
| `auth/tenant-isolation.test.ts` | 1 |
| `config/env.test.ts` | 6 |
| `imports/csv-import.test.ts` | 1 |
| `middleware/auth-rate-limiter.test.ts` | 1 |
| `middleware/error-handler.test.ts` | 6 |
| `middleware/idempotency.test.ts` | 2 |
| `middleware/rate-limiter.test.ts` | 4 |
| `middleware/rbac-matrix.test.ts` | 5 |
| `middleware/request-id.test.ts` | 2 |
| `models/database-views.test.ts` | 6 |
| `models/paise-validation.test.ts` | 4 |
| `models/partial-indexes.test.ts` | 6 |
| `models/ref-types.test.ts` | 2 |
| `models/schema-indexes.test.ts` | 11 |
| `models/schema-v4-rules.test.ts` | 33 |
| `orders/phase-b-c-d-workflows.test.ts` | 9 |
| `orders/quotation-workflow.test.ts` | 11 |
| `repositories/base-repository.test.ts` | 7 |
| `repositories/orders-repository.test.ts` | 16 |
| `repositories/unit-of-work.test.ts` | 7 |
| `routes/health.test.ts` | 6 |
| `scripts/create-admin.test.ts` | 1 |
| `stock/goods-receipt.test.ts` | 1 |
| `utils/dates.test.ts` | 7 |
| `utils/logger.test.ts` | 5 |
| `utils/money.test.ts` | 11 |
| `utils/pagination.test.ts` | 4 |

---
