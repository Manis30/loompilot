# Backend Current State Report - Part 1
> Scope: Sections 1 through 5. Read-only architectural snapshot of LoomPilot backend (`apps/api` and `packages/shared`).

---

## 1. Overview

### Folder Tree (apps/api/src & packages/shared, 2 levels deep)
```text
apps/api/src/
├── app.ts
├── container.ts
├── server.ts
├── config/ (5 files)
├── controllers/ (14 files)
├── errors/ (1 file)
├── integrations/ (agents: 1, notifier: 4, pdf: 1)
├── interfaces/ (19 files)
├── jobs/ (3 files)
├── mappers/ (12 files)
├── middleware/ (7 files)
├── models/ (13 files)
├── realtime/ (1 file)
├── repositories/ (15 files)
├── routes/ (15 files)
├── seed/ (1 file)
├── services/ (14 files)
├── utils/ (5 files)
└── validators/ (12 files)

packages/shared/src/
├── constants.ts
├── enums.ts
├── index.ts
├── money.ts
└── schemas/ (7 files)
```

### File Counts Per Layer (apps/api/src)
| Layer | Directory | File Count | Primary Purpose |
| :--- | :--- | :---: | :--- |
| **Server & Root** | `src/` | 3 | Server bootstrap, Express setup, composition root (`container.ts`) |
| **Config** | `src/config/` | 5 | Env parsing, Pino logger, Mongo connection, Redis client, constants |
| **Controllers** | `src/controllers/` | 14 | HTTP request handling, DTO mapping, status responses |
| **Errors** | `src/errors/` | 1 | Domain & HTTP error hierarchy (`AppError`, `NotFoundError`, etc.) |
| **Integrations** | `src/integrations/` | 6 | External boundaries: Notifiers (4), PDF (1), Agents (1) |
| **Interfaces** | `src/interfaces/` | 19 | Pure contracts: Repositories, Unit-of-Work, Notifiers, Queues |
| **Jobs** | `src/jobs/` | 3 | Background queue abstractions, processors, sweep schedulers |
| **Mappers** | `src/mappers/` | 12 | Entity-to-DTO transformation & role-based field masking |
| **Middleware** | `src/middleware/` | 7 | JWT auth, RBAC, Zod validation, audit logging, request ID, errors |
| **Models** | `src/models/` | 13 | Mongoose schemas, document interfaces, compound indexes |
| **Realtime** | `src/realtime/` | 1 | Socket.IO handshake auth, rooms, role-gated emitters |
| **Repositories** | `src/repositories/` | 15 | Concrete MongoDB/Mongoose database access implementations |
| **Routes** | `src/routes/` | 15 | Express Router definitions and middleware attachments |
| **Seed** | `src/seed/` | 1 | Development database seeder with production guard |
| **Services** | `src/services/` | 14 | Business orchestration, domain rules, transaction coordination |
| **Utils** | `src/utils/` | 5 | Async handler, Actor context, date helpers, pagination, money |
| **Validators** | `src/validators/` | 12 | Zod request schemas |

### Tech Versions
| Technology | Version / Spec | Source File |
| :--- | :--- | :--- |
| **Node.js** | `v22.14.0` (types: `^22.13.1`) | `apps/api/package.json#L41` |
| **Express** | `^4.21.2` | `apps/api/package.json#L24` |
| **Mongoose** | `^8.10.0` (installed `8.24.7`) | `apps/api/package.json#L27` |
| **Zod** | `^3.24.2` | `apps/api/package.json#L33` |
| **Vitest** | `^3.0.5` (runtime `v3.2.7`) | `apps/api/package.json#L51` |
| **Queue** | BullMQ `^5.41.0` in dependencies; active runtime is `InMemoryJobQueue` (**STUB**) | `apps/api/src/jobs/queues.ts#L4` |
| **Socket.IO** | `^4.8.1` | `apps/api/package.json#L32` |

### API Base Path & Conventions
- **Base Path & Version Prefix**: No version prefix exists (no `/api/v1`). Routes are mounted at `/health` (public), `/internal/*` (service-token gated), and `/api/*` (JWT authenticated). Source: `apps/api/src/app.ts#L42-L68`.
- **Error Response Shape**: `{ error: string, message: string, details?: any, requestId?: string }`. Uses standard HTTP status codes (`400`, `401`, `403`, `404`, `409`, `500`). Source: `apps/api/src/middleware/errorHandler.ts#L14-L25`.
- **Pagination & Filtering**: Standardized via `parsePaginationQuery` (`page` default 1, `limit` default 20 max 100). Filtering via ad-hoc controller query params (`status`, `date`, `customerId`). Source: `apps/api/src/utils/pagination.ts#L10-L24`.
- **Idempotency Keys**: Required on `POST /api/workforce/daily-outputs` via `idempotencyKey` field in request body and unique compound index. No global HTTP idempotency header middleware. Source: `apps/api/src/models/workforce.model.ts#L96`.
- **Optimistic Concurrency**: Not implemented. Schemas do not enforce Mongoose `__v` optimistic locking checks.
- **Soft Delete**: Not implemented. No `isDeleted` or `deletedAt` fields on any Mongoose schema; deletions are hard database deletes.
- **Timestamps**: Enabled across all schemas via `{ timestamps: true }` (`createdAt`, `updatedAt`), or `{ timestamps: { createdAt: true, updatedAt: false } }` for append-only ledgers.

---

## 2. Data Models

All 19 Mongoose models across 13 files enforce a required and indexed `tenantId: { type: String, required: true, index: true }`.

### Mongoose Models Specification Table
| Model | Schema File | Fields (Type, Required, Default/Enum) | Indexes (Unique & Compound) |
| :--- | :--- | :--- | :--- |
| **Alert** | `models/alert.model.ts#L25` | `tenantId` (String, req), `orderId` (ObjectId, req), `processId` (ObjectId, req), `date` (String, req), `type` (String, req, `AlertType`), `severity` (String, def `medium`, `AlertSeverity`), `title` (String, req), `message` (String, req), `metrics` (Object, req: `requiredDaily`, `actualRate`, `deficitQty`, `delayDaysEstimated`), `isAcknowledged` (Boolean, def `false`) | Compound Unique: `{ tenantId: 1, orderId: 1, processId: 1, date: 1, type: 1 }`<br>Index: `{ tenantId: 1, createdAt: -1 }` |
| **Recommendation** | `models/alert.model.ts#L91` | `tenantId` (String, req), `alertId` (ObjectId, req), `orderId` (ObjectId, req), `status` (String, req, def `proposed`, `RecommendationStatus`), `title` (String, req), `explanation` (String, req), `options` (Array of `RecoveryOptionSchema`), `selectedOptionId` (String), `decidedBy` (ObjectId), `decidedAt` (Date), `rejectionReason` (String) | Index: `{ tenantId: 1, alertId: 1 }`<br>Index: `{ tenantId: 1, orderId: 1 }` |
| **AuditLog** | `models/audit.model.ts#L8` | `tenantId` (String, req), `userId` (String, req), `userRole` (String, req), `action` (String, req), `entity` (String, req), `entityId` (String), `changes` (Mixed), `ipAddress` (String), `userAgent` (String), `statusCode` (Number, def 200), `durationMs` (Number, def 0), `requestId` (String, def "unknown") | Index: `{ tenantId: 1, createdAt: -1 }`<br>Index: `{ tenantId: 1, userId: 1 }` |
| **Customer** | `models/customer.model.ts#L16` | `tenantId` (String, req), `name` (String, req), `code` (String, req), `contactPerson` (String, req), `email` (String, req), `phone` (String, req), `address` (String), `creditPeriodDays` (Number, def 30) | Compound Unique: `{ tenantId: 1, code: 1 }` |
| **Delivery** | `models/delivery.model.ts#L21` | `tenantId` (String, req), `orderId` (ObjectId, req), `customerId` (ObjectId, req), `deliveryNumber` (String, req), `deliveredQuantity` (Number, req, min 1), `deliveryDate` (String, req), `status` (String, req, def `delivered`, `DeliveryStatus`), `isOnTime` (Boolean, req, def `true`), `invoiceNumber` (String, req), `totalInvoicePaise` (Number, req, min 0), `receivedBy` (String), `notes` (String) | Compound Unique: `{ tenantId: 1, deliveryNumber: 1 }`<br>Compound Unique: `{ tenantId: 1, invoiceNumber: 1 }` |
| **Enquiry** | `models/enquiry.model.ts#L21` | `tenantId` (String, req), `enquiryNumber` (String, req), `customerId` (String, req), `customerName` (String, req), `rawText` (String, req), `parsedRequirements` (Object: `productName`, `quantity`, `unit`, `targetDeliveryDate`, `specialInstructions`), `status` (String, def `new`, enum: `new`, `processing`, `quoted`, `closed`) | Compound Unique: `{ tenantId: 1, enquiryNumber: 1 }` |
| **Material** | `models/material.model.ts#L20` | `tenantId` (String, req), `code` (String, req), `name` (String, req), `type` (String, req, `MaterialType`), `unit` (String, req), `currentRatePaise` (Number, req, min 0), `avgCostPaise` (Number, req, min 0), `onHandQuantity` (Number, def 0, min 0), `reservedQuantity` (Number, def 0, min 0), `reorderLevel` (Number, def 0, min 0) | Compound Unique: `{ tenantId: 1, code: 1 }` |
| **StockMovement** | `models/material.model.ts#L54` | `tenantId` (String, req), `materialId` (ObjectId, req), `type` (String, req, `StockMovementType`), `quantity` (Number, req), `previousBalance` (Number, req), `newBalance` (Number, req), `referenceType` (String, req, enum: `receipt`, `order_issue`, `reservation`, `adjustment`), `referenceId` (String), `notes` (String) | Index: `{ tenantId: 1, materialId: 1, createdAt: -1 }` |
| **Reservation** | `models/material.model.ts#L89` | `tenantId` (String, req), `materialId` (ObjectId, req), `orderId` (ObjectId, req), `quantity` (Number, req, min 0), `status` (String, def `reserved`, enum: `reserved`, `allocated`, `released`) | Index: `{ tenantId: 1, materialId: 1 }`<br>Index: `{ tenantId: 1, orderId: 1 }` |
| **PriceHistory** | `models/material.model.ts#L117` | `tenantId` (String, req), `materialId` (ObjectId, req), `date` (String, req), `ratePaise` (Number, req, min 0), `source` (String, def "manual") | Index: `{ tenantId: 1, materialId: 1, date: -1 }` |
| **ProductionOrder** | `models/order.model.ts#L46` | `tenantId` (String, req), `quotationId` (ObjectId, req), `customerId` (ObjectId, req), `orderNumber` (String, req), `productName` (String, req), `totalQuantity` (Number, req, min 1), `unit` (String, req, def "meters"), `status` (String, req, def `planned`, `OrderStatus`), `startDate` (String, req), `targetDeliveryDate` (String, req), `actualDeliveryDate` (String), `plan` (Array of `ProcessPlanStepSchema`) | Compound Unique: `{ tenantId: 1, orderNumber: 1 }` |
| **Payment** | `models/payment.model.ts#L58` | `tenantId` (String, req), `deliveryId` (ObjectId, req), `orderId` (ObjectId, req), `customerId` (ObjectId, req), `invoiceNumber` (String, req), `totalInvoicePaise` (Number, req, min 0), `amountReceivedPaise` (Number, def 0, min 0), `balancePaise` (Number, req, min 0), `dueDate` (String, req), `status` (String, req, def `pending`, `PaymentStatus`), `paymentTerms` (String, def "Net 30"), `reminders` (Array of `PaymentReminderDraftSchema`) | Compound Unique: `{ tenantId: 1, invoiceNumber: 1 }` |
| **Process** | `models/process.model.ts#L15` | `tenantId` (String, req), `name` (String, req, `ProcessName`), `sequence` (Number, req), `standardWastagePct` (Number, req, def 2.0), `avgOutputPerWorkerHour` (Number, req, def 10), `unit` (String, req, def "meters") | Compound Unique: `{ tenantId: 1, name: 1 }`<br>Index: `{ tenantId: 1, sequence: 1 }` |
| **Quotation** | `models/quotation.model.ts#L64` | `tenantId` (String, req), `enquiryId` (ObjectId, req), `customerId` (ObjectId, req), `quotationNumber` (String, req), `lineItems` (Array of `QuotationLineItemSchema`), `materialCostPaise` (Number, req, def 0), `processingCostPaise` (Number, req, def 0), `overheadCostPaise` (Number, req, def 0), `wastagePct` (Number, req, def 2.5), `wastageCostPaise` (Number, req, def 0), `riskBufferPct` (Number, req, def 5.0), `riskBufferCostPaise` (Number, req, def 0), `subtotalCostPaise` (Number, req, def 0), `marginPct` (Number, req, def 15.0), `profitPaise` (Number, req, def 0), `finalPricePaise` (Number, req, def 0), `etaDate` (String, req), `validUntil` (String, req), `status` (String, req, def `draft`, `QuotationStatus`), `explanation` (String, def ""), `assumptions` (Array of String), `inputsSnapshot` (Mixed, def `{}`), `generationError` (String), `approvedBy` (ObjectId), `approvedAt` (Date), `sentAt` (Date) | Compound Unique: `{ tenantId: 1, quotationNumber: 1 }` |
| **Supplier** | `models/supplier.model.ts#L16` | `tenantId` (String, req), `name` (String, req), `contactPerson` (String, req), `email` (String, req), `phone` (String, req), `leadTimeDays` (Number, req, def 7), `rating` (Number, def 4.5, min 1, max 5), `suppliedMaterials` (Array of ObjectId ref "Material") | Index: `{ tenantId: 1, name: 1 }` |
| **User** | `models/user.model.ts#L16` | `tenantId` (String, req), `email` (String, req, lowercase, trim), `passwordHash` (String, req), `name` (String, req), `role` (String, req, def `sales`, `UserRole`), `isActive` (Boolean, def `true`), `refreshTokens` (Array of String) | Compound Unique: `{ tenantId: 1, email: 1 }` |
| **Worker** | `models/workforce.model.ts#L16` | `tenantId` (String, req), `workerCode` (String, req), `name` (String, req), `skillLevel` (String, def `semi_skilled`, enum: `unskilled`, `semi_skilled`, `skilled`), `hourlyRatePaise` (Number, req, def 12000), `assignedProcessId` (ObjectId ref "Process"), `active` (Boolean, def `true`) | Compound Unique: `{ tenantId: 1, workerCode: 1 }` |
| **Attendance** | `models/workforce.model.ts#L47` | `tenantId` (String, req), `workerId` (ObjectId, req), `date` (String, req), `isPresent` (Boolean, def `true`), `hoursWorked` (Number, def 8, min 0, max 24) | Compound Unique: `{ tenantId: 1, workerId: 1, date: 1 }`<br>Index: `{ tenantId: 1, date: 1 }` |
| **DailyOutput** | `models/workforce.model.ts#L79` | `tenantId` (String, req), `orderId` (ObjectId, req), `processId` (ObjectId, req), `date` (String, req), `quantityProduced` (Number, req, min 0), `quantityDefective` (Number, def 0, min 0), `operatorId` (String), `notes` (String), `idempotencyKey` (String, req) | Compound Unique: `{ tenantId: 1, orderId: 1, processId: 1, date: 1 }`<br>Compound Unique: `{ tenantId: 1, idempotencyKey: 1 }` |

### Domain Inventory Check (YES / NO with File Paths)
| Feature Question | Answer | Citations / Verification File Path |
| :--- | :---: | :--- |
| Product or BOM (material quantity per unit) | **NO** | No product or BOM collection exists in `apps/api/src/models/` |
| Process routing per product | **NO** | No routing model. `ProcessModel` sequence is global per tenant; orders copy process sequence |
| Wastage % per product or process | **YES** | Per process: `apps/api/src/models/process.model.ts#L20` (`standardWastagePct`, default 2.0). Per quotation: `apps/api/src/models/quotation.model.ts#L74` (`wastagePct`). NO per product. |
| Settings model (thresholds, margin, risk limits) | **NO** | No settings model. Values hardcoded in schema defaults and `apps/api/src/config/constants.ts` |
| Working calendar, holidays or shifts | **NO** | No calendar, holiday, or shift models exist |
| Purchase / goods-receipt / arrival records (expected vs actual) | **NO** | No PO or goods-receipt tracking model exists |
| Actual cost capture per order (material issues, labour cost) | **NO** | `order.model.ts` and `workforce.model.ts` record quantities only, not order costs incurred |
| Stock adjustment or goods receipt endpoints | **NO** | `material.routes.ts` lacks adjustment or goods-receipt routes; only generic movement ledger |
| User notification preferences | **NO** | `user.model.ts` has no notification preference fields |
| In-app notification list with read state | **NO** | Only `AlertModel.isAcknowledged` exists; no general notification inbox model |
| Notification delivery log or outbox | **NO** | No outbox table or delivery log model exists |
| Payment terms, due date and amount due | **YES** | `apps/api/src/models/payment.model.ts#L65-L76` (`paymentTerms`, `dueDate`, `totalInvoicePaise`, `balancePaise`) |
| CSV import | **NO** | No CSV import schemas, services, or endpoints exist |
| OpenAPI or Swagger docs | **NO** | No OpenAPI specification file or Swagger middleware exists |

---

## 3. Routes

| Method | Full Path | Auth / Allowed Roles | Validator Schema | Controller Method | Service Method |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/health` | **Public** (no auth) | None | Inline in `app.ts` | None |
| `POST` | `/api/auth/login` | **Public** (no auth) | `LoginSchema` | `AuthController.login` | `AuthService.login` |
| `POST` | `/api/auth/refresh` | **Public** (cookie auth) | None | `AuthController.refresh` | `AuthService.refreshToken` |
| `POST` | `/api/auth/register` | Conditional Public (First Owner) / Owner-Only | `RegisterUserSchema` | `AuthController.register` | `AuthService.register` |
| `POST` | `/api/auth/logout` | Authenticated (Any Role) | None | `AuthController.logout` | `AuthService.logout` |
| `GET` | `/api/auth/me` | Authenticated (Any Role) | None | `AuthController.me` | None (reads `req.user`) |
| `GET` | `/api/customers` | Authenticated (Any Role) | None | `CustomerController.list` | `CustomerService.list` |
| `GET` | `/api/customers/:id` | Authenticated (Any Role) | None | `CustomerController.getById` | `CustomerService.getById` |
| `POST` | `/api/customers` | `OWNER`, `MANAGER`, `SALES` | `CreateCustomerSchema` | `CustomerController.create` | `CustomerService.create` |
| `GET` | `/api/enquiries` | Authenticated (Any Role) | None | `EnquiryController.list` | `EnquiryService.list` |
| `GET` | `/api/enquiries/:id` | Authenticated (Any Role) | None | `EnquiryController.getById` | `EnquiryService.getById` |
| `POST` | `/api/enquiries` | `OWNER`, `MANAGER`, `SALES` | `CreateEnquirySchema` | `EnquiryController.create` | `EnquiryService.create` |
| `GET` | `/api/quotations` | Authenticated (Any Role, Store masked) | None | `QuotationController.list` | `QuotationService.list` |
| `GET` | `/api/quotations/:id` | Authenticated (Any Role, Store masked) | None | `QuotationController.getById` | `QuotationService.getById` |
| `GET` | `/api/quotations/:id/pdf`| Authenticated (Any Role) | None | `QuotationController.downloadPdf` | `QuotationService.send` / `renderQuotation` |
| `POST` | `/api/quotations/draft` | `OWNER`, `MANAGER`, `SALES` | None | `QuotationController.requestDraft` | `QuotationService.requestDraft` |
| `POST` | `/api/quotations/:id/recalculate` | `OWNER`, `MANAGER`, `SALES` | None | `QuotationController.recalculate` | `QuotationService.recalculate` |
| `POST` | `/api/quotations/:id/approve` | `OWNER`, `MANAGER` | None | `QuotationController.approve` | `QuotationService.approve` |
| `POST` | `/api/quotations/:id/send` | `OWNER`, `MANAGER`, `SALES` | None | `QuotationController.send` | `QuotationService.send` |
| `POST` | `/api/quotations/:id/confirm` | `OWNER`, `MANAGER` | None | `QuotationController.confirm` | `QuotationService.confirmOrder` |
| `GET` | `/api/materials` | Authenticated (Any Role, Store masked) | None | `MaterialController.list` | `MaterialService.list` |
| `GET` | `/api/materials/:id` | Authenticated (Any Role, Store masked) | None | `MaterialController.getById` | `MaterialService.getById` |
| `GET` | `/api/materials/:id/movements` | Authenticated (Any Role) | None | `MaterialController.getMovements` | `MaterialService.getMovements` |
| `GET` | `/api/materials/:id/price-history` | Authenticated (Any Role) | None | `MaterialController.getPriceHistory` | `MaterialService.getPriceHistory` |
| `POST` | `/api/materials` | `OWNER`, `MANAGER` | `CreateMaterialSchema` | `MaterialController.create` | `MaterialService.create` |
| `POST` | `/api/materials/:id/movements` | `OWNER`, `MANAGER`, `STORE` | `RecordMovementSchema` | `MaterialController.recordMovement` | `MaterialService.recordMovement` |
| `GET` | `/api/suppliers` | Authenticated (Any Role) | None | `SupplierController.list` | `SupplierService.list` |
| `GET` | `/api/suppliers/:id` | Authenticated (Any Role) | None | `SupplierController.getById` | `SupplierService.getById` |
| `POST` | `/api/suppliers` | `OWNER`, `MANAGER`, `STORE` | `CreateSupplierSchema` | `SupplierController.create` | `SupplierService.create` |
| `GET` | `/api/processes` | Authenticated (Any Role) | None | `ProcessController.list` | `ProcessService.list` |
| `GET` | `/api/processes/:id` | Authenticated (Any Role) | None | `ProcessController.getById` | `ProcessService.getById` |
| `POST` | `/api/processes` | `OWNER`, `MANAGER` | `CreateProcessSchema` | `ProcessController.create` | `ProcessService.create` |
| `GET` | `/api/workforce/workers` | Authenticated (Any Role) | None | `WorkforceController.listWorkers` | `WorkforceService.listWorkers` |
| `POST` | `/api/workforce/workers` | `OWNER`, `MANAGER` | `CreateWorkerSchema` | `WorkforceController.createWorker` | `WorkforceService.createWorker` |
| `GET` | `/api/workforce/attendance` | Authenticated (Any Role) | None | `WorkforceController.getAttendance` | `WorkforceService.getAttendance` |
| `POST` | `/api/workforce/attendance` | `OWNER`, `MANAGER` | `RecordAttendanceSchema` | `WorkforceController.recordAttendance` | `WorkforceService.recordAttendance` |
| `POST` | `/api/workforce/daily-outputs` | `OWNER`, `MANAGER` | `RecordDailyOutputSchema` | `WorkforceController.recordDailyOutput` | `WorkforceService.recordDailyOutput` |
| `GET` | `/api/workforce/orders/:orderId/outputs` | Authenticated (Any Role) | None | `WorkforceController.getOutputsForOrder` | `WorkforceService.getOutputsForOrder` |
| `GET` | `/api/orders` | Authenticated (Any Role) | None | `OrderController.list` | `OrderService.list` |
| `GET` | `/api/orders/:id` | Authenticated (Any Role) | None | `OrderController.getById` | `OrderService.getById` |
| `GET` | `/api/orders/:id/variance` | `OWNER`, `MANAGER`, `SALES` | None | `OrderController.getVariance` | `OrderService.getVariance` |
| `GET` | `/api/alerts` | Authenticated (Any Role) | None | `AlertController.listAlerts` | `AlertService.listAlerts` |
| `POST` | `/api/alerts/:id/ack` | `OWNER`, `MANAGER` | None | `AlertController.acknowledgeAlert` | `AlertService.acknowledgeAlert` |
| `GET` | `/api/alerts/recommendations` | Authenticated (Any Role) | None | `AlertController.listRecommendations` | `AlertService.listRecommendations` |
| `POST` | `/api/alerts/recommendations/:id/decide` | `OWNER`, `MANAGER` | `DecideRecommendationSchema` | `AlertController.decideRecommendation` | `AlertService.decideRecommendation` |
| `GET` | `/api/deliveries` | Authenticated (Any Role) | None | `DeliveryController.list` | `DeliveryService.list` |
| `GET` | `/api/deliveries/:id` | Authenticated (Any Role) | None | `DeliveryController.getById` | `DeliveryService.getById` |
| `POST` | `/api/deliveries` | `OWNER`, `MANAGER`, `STORE` | `RecordDeliverySchema` | `DeliveryController.recordDelivery` | `DeliveryService.recordDelivery` |
| `GET` | `/api/payments` | `OWNER`, `MANAGER`, `ACCOUNTS` | None | `PaymentController.list` | `PaymentService.list` |
| `GET` | `/api/payments/:id` | `OWNER`, `MANAGER`, `ACCOUNTS` | None | `PaymentController.getById` | `PaymentService.getById` |
| `POST` | `/api/payments/:id/reminders/:reminderId/approve` | `ACCOUNTS` (strictly exclusive) | `ApproveReminderSchema` | `PaymentController.approveReminder` | `PaymentService.approveReminder` |
| `POST` | `/api/payments/:id/receipts` | `OWNER`, `ACCOUNTS` | `RecordReceiptSchema` | `PaymentController.recordReceipt` | `PaymentService.recordReceipt` |
| `GET` | `/api/reports/margin` | `OWNER`, `ACCOUNTS` | None | `ReportController.getMarginReport` | `ReportService.getMarginReport` |
| `GET` | `/api/reports/on-time` | `OWNER`, `MANAGER`, `SALES` | None | `ReportController.getOnTimeReport` | `ReportService.getOnTimeReport` |
| `GET` | `/api/reports/collections` | `OWNER`, `ACCOUNTS` | None | `ReportController.getCollectionsReport` | `ReportService.getCollectionsReport` |
| `POST` | `/internal/quotations/drafts` | **Internal** (`x-service-token`) | `CreateQuotationDraftSchema` | `AgentGatewayController.ingestQuotationDraft` | `QuotationService.createDraft` |
| `POST` | `/internal/alerts` | **Internal** (`x-service-token`) | `CreateAlertSchema` | `AgentGatewayController.ingestAlert` | `AlertService.createAlert` |
| `POST` | `/internal/recommendations` | **Internal** (`x-service-token`) | `CreateRecommendationSchema` | `AgentGatewayController.ingestRecommendation` | `AlertService.createRecommendation` |
| `POST` | `/internal/monitoring-snapshots` | **Internal** (`x-service-token`) | None | `AgentGatewayController.recordMonitoringSnapshot` | `AgentGatewayService.recordMonitoringSnapshot` |
| `POST` | `/internal/payment-followups` | **Internal** (`x-service-token`) | `CreatePaymentFollowupSchema` | `AgentGatewayController.ingestPaymentFollowup` | `PaymentService.createFollowup` |
| `POST` | `/internal/payment-reminder-drafts` | **Internal** (`x-service-token`) | `AddReminderDraftSchema` | `AgentGatewayController.ingestPaymentReminderDraft` | `PaymentService.addReminderDraft` |

---

## 4. Services

### Public Methods & Integration Matrix
| Service | Public Method | One-Line Summary | Repositories / Services Called | Jobs Enqueued | Socket.IO Events | Audit Log Action | Status Transitions |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **AuthService** | `register` | Registers first tenant owner or creates user via owner | `IUserRepository` | None | None | `USER_REGISTERED` | None |
| | `login` | Validates credentials, issues access & refresh tokens | `IUserRepository` | None | None | None | None |
| | `refreshToken` | Rotates refresh token with reuse detection | `IUserRepository` | None | None | None | None |
| | `logout` | Revokes refresh token for user | `IUserRepository` | None | None | None | None |
| **QuotationService** | `list` / `getById` | Paginated listing and ID lookup | `IQuotationRepository` | None | None | None | None |
| | `requestDraft` | Shell draft quotation, delegates to agents or fails | `IQuotationRepository`, `IAgentsClient` | None | None | None | `draft` -> `generation_failed` |
| | `createDraft` | Ingests full quotation proposal from agent gateway | `IQuotationRepository` | None | None | `QUOTATION_DRAFT_CREATED` | Sets `draft` |
| | `recalculate` | Recomputes pricing via agents on line item edit | `IQuotationRepository`, `IAgentsClient` | None | None | `QUOTATION_RECALCULATED` | None |
| | `approve` | Human review approval of quotation | `IQuotationRepository` | None | None | `QUOTATION_APPROVED` | `draft` -> `approved` |
| | `send` | Generates PDF, updates quotation to sent status | `IQuotationRepository`, `ICustomerRepository`, `IPdfRenderer` | None | None | `QUOTATION_SENT` | `approved` -> `sent` |
| | `confirmOrder` | Transactionally reserves stock, builds plan, creates order | `IQuotationRepository`, `IMaterialRepository`, `IProcessRepository`, `IOrderRepository`, `IUnitOfWork` | None | None | `QUOTATION_CONFIRMED` | `approved`/`sent` -> `confirmed` |
| **WorkforceService** | `listWorkers` / `createWorker` | Manages worker workforce directory | `IWorkforceRepository` | None | None | `WORKER_CREATED` | None |
| | `recordAttendance` | Records daily attendance and hours worked | `IWorkforceRepository` | None | None | None | None |
| | `recordDailyOutput` | Captures daily production output idempotently | `IWorkforceRepository`, `IUnitOfWork` | `monitoringTrigger` (debounced order monitoring job) | None | `DAILY_OUTPUT_RECORDED` | None |
| | `getOutputsForOrder` | Retrieves all output records for an order | `IWorkforceRepository` | None | None | None | None |
| **OrderService** | `list` / `getById` | Paginated listing and ID lookup | `IOrderRepository` | None | None | None | None |
| | `getVariance` | Calculates cumulative output and target deficit | `IOrderRepository`, `IWorkforceRepository` | None | None | None | None |
| **AlertService** | `listAlerts` / `listRecommendations` | Lists alerts and recovery recommendations | `IAlertRepository` | None | None | None | None |
| | `createAlert` | Upserts alert and broadcasts via Socket.IO | `IAlertRepository` | None | `alert:new` to Owner & Manager | `ALERT_CREATED` | None |
| | `acknowledgeAlert` | Marks production alert as acknowledged | `IAlertRepository` | None | None | `ALERT_ACKNOWLEDGED` | `isAcknowledged: false` -> `true` |
| | `createRecommendation`| Stores recovery option recommendation | `IAlertRepository` | None | None | `RECOMMENDATION_CREATED` | Sets `proposed` |
| | `decideRecommendation`| Accepts or rejects recovery recommendation | `IAlertRepository` | None | None | `RECOMMENDATION_ACCEPTED` / `REJECTED` | `proposed` -> `accepted` / `rejected` |
| **DeliveryService** | `list` / `getById` | Paginated listing and ID lookup | `IDeliveryRepository` | None | None | None | None |
| | `recordDelivery` | Records delivery, completes order, triggers payment job | `IDeliveryRepository`, `IOrderRepository`, `IUnitOfWork` | `deliveryTrigger` (payment followup job) | None | `DELIVERY_RECORDED` | Order: `planned`/`in_progress` -> `completed` |
| **PaymentService** | `list` / `getById` | Paginated listing and ID lookup | `IPaymentRepository` | None | None | None | None |
| | `createFollowup` | Initializes invoice balance and terms | `IPaymentRepository` | None | None | `PAYMENT_FOLLOWUP_CREATED` | Sets `pending` |
| | `addReminderDraft` | Adds advisory reminder draft to payment | `IPaymentRepository` | None | None | None | Sets reminder `draft` |
| | `approveReminder` | Accounts approval or rejection of reminder | `IPaymentRepository` | None | None | `REMINDER_APPROVED` / `CANCELLED` | Reminder: `draft` -> `approved` / `cancelled` |
| | `recordReceipt` | Records invoice payment receipt, recalculates balance | `IPaymentRepository` | None | None | `PAYMENT_RECEIPT_RECORDED` | `pending` -> `partial` or `received` |
| **ReportService** | `getMarginReport` | Aggregates revenue, cost, and margin % | `IReportRepository` | None | None | None | None |
| | `getOnTimeReport` | Aggregates delivery punctuality and late counts | `IReportRepository` | None | None | None | None |
| | `getCollectionsReport` | Aggregates invoice collections and overdue aging | `IReportRepository` | None | None | None | None |
| **MaterialService** | `list` / `getById` / `create` | Manages raw material inventory | `IMaterialRepository` | None | None | `MATERIAL_CREATED` | None |
| | `recordMovement` | Records stock ledger movement and balance | `IMaterialRepository` | None | None | `STOCK_MOVEMENT_RECORDED` | None |
| **CustomerService** | `list` / `getById` / `create` | Manages customer records | `ICustomerRepository` | None | None | `CUSTOMER_CREATED` | None |
| **ProcessService** | `list` / `getById` / `create` | Manages process routing definitions | `IProcessRepository` | None | None | `PROCESS_CREATED` | None |
| **SupplierService** | `list` / `getById` / `create` | Manages supplier records and lead times | `ISupplierRepository` | None | None | `SUPPLIER_CREATED` | None |
| **AgentGatewayService**| Gateway ingestion methods | Delegates incoming agent proposals to services | `QuotationService`, `AlertService`, `PaymentService` | None | None | Delegated to underlying services | Delegated |

### Exact Numeric Formulas Computed in Node (`apps/api`)
1. **Variance Tracking Deficit**:
   - Source: `apps/api/src/services/order.service.ts#L46-L62`
   - Formulas:
     ```ts
     cumulativeActual += out.quantityProduced;
     deficit = Math.max(0, plannedTarget - actualCumulative);
     isBehind = actualCumulative < plannedTarget;
     ```
2. **Gross Margin Report**:
   - Source: `apps/api/src/services/report.service.ts#L20-L42`
   - Formulas:
     ```ts
     cost = (q.subtotalCostPaise || 0) + (q.wastageCostPaise || 0) + (q.riskBufferCostPaise || 0);
     margin = revenue - cost;
     marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;
     grossMarginPaise = totalRevenuePaise - totalCostPaise;
     grossMarginPct = totalRevenuePaise > 0 ? (grossMarginPaise / totalRevenuePaise) * 100 : 0;
     ```
3. **On-Time Delivery Rate**:
   - Source: `apps/api/src/services/report.service.ts#L57-L69`
   - Formulas:
     ```ts
     totalDeliveries = deliveries.length;
     onTimeDeliveries = deliveries.filter((d) => d.isOnTime).length;
     lateDeliveries = totalDeliveries - onTimeDeliveries;
     onTimeRatePct = totalDeliveries > 0 ? (onTimeDeliveries / totalDeliveries) * 100 : 100;
     averageDelayDays = lateDeliveries > 0 ? 3.5 : 0; // STUB: hardcoded placeholder constant
     ```
4. **Collections Aging**:
   - Source: `apps/api/src/services/report.service.ts#L84-L104`
   - Formulas:
     ```ts
     totalInvoicedPaise += p.totalInvoicePaise;
     totalCollectedPaise += p.amountReceivedPaise;
     totalOutstandingPaise += p.balancePaise;
     if (p.dueDate < todayStr && p.balancePaise > 0) totalOverduePaise += p.balancePaise;
     currentPaise = totalOutstandingPaise - totalOverduePaise;
     days1To30Paise = totalOverduePaise;
     days31To60Paise = 0; // STUB: placeholder constant
     days61PlusPaise = 0;  // STUB: placeholder constant
     ```
5. **Payment Balance & Status**:
   - Source: `apps/api/src/services/payment.service.ts#L40,L152-L154`
   - Formulas:
     ```ts
     balancePaise = input.totalInvoicePaise - (input.amountReceivedPaise ?? 0);
     newAmountReceived = payment.amountReceivedPaise + amountPaise;
     newBalance = Math.max(0, payment.totalInvoicePaise - newAmountReceived);
     newStatus = newBalance === 0 ? PaymentStatus.RECEIVED : PaymentStatus.PARTIAL;
     ```
6. **Delivery On-Time Check**:
   - Source: `apps/api/src/services/delivery.service.ts#L52-L53`
   - Formulas:
     ```ts
     deliveryDateStr = input.deliveryDate || new Date().toISOString().split("T")[0]!;
     isOnTime = deliveryDateStr <= order.targetDeliveryDate;
     ```
7. **Order Confirmation Stock Reservation & Daily Target**:
   - Source: `apps/api/src/services/quotation.service.ts#L324,L379`
   - Formulas:
     ```ts
     reserveQty = Math.min(item.onHandQty, item.requiredQty);
     dailyTarget = Math.round(totalQty / 5); // 5-day staged plan interval per process
     ```

---

## 5. State Machines

| Entity | Enum Values | Allowed & Validated Transitions in Code | Transitions Possible in Enum but NOT Validated |
| :--- | :--- | :--- | :--- |
| **Enquiry** | `new`, `processing`, `quoted`, `closed` | Initialized to `new` on `create` (`apps/api/src/models/enquiry.model.ts#L38`). | `processing`, `quoted`, `closed` (no transition methods exist in `EnquiryService`) |
| **Quotation** | `draft`, `approved`, `sent`, `confirmed`, `rejected`, `expired`, `generation_failed` | `draft` -> `generation_failed` (`requestDraft` on agent client error)<br>`draft` -> `approved` (`approve`, validates `status !== CONFIRMED`)<br>`approved` -> `sent` (`send`, sets `sentAt`)<br>`approved` / `sent` -> `confirmed` (`confirmOrder`, validates `status !== CONFIRMED`) | `rejected`, `expired` (in enum, but no rejection or expiration methods in `QuotationService`) |
| **ProductionOrder** | `planned`, `in_progress`, `completed`, `cancelled` | Initialized to `planned` on `confirmOrder`<br>`planned` / `in_progress` -> `completed` on `recordDelivery` (`DeliveryService.recordDelivery#L74`) | `in_progress`, `cancelled` (not explicitly updated by service methods) |
| **Delivery** | `pending`, `in_transit`, `delivered`, `failed` | Created directly with status `delivered` on `recordDelivery` (`DeliveryService.recordDelivery#L32`) | `pending`, `in_transit`, `failed` (never transitioned in code) |
| **Payment** | `pending`, `partial`, `received`, `overdue` | Initialized to `pending` on `createFollowup`<br>`pending` / `partial` -> `received` (when `balancePaise === 0`)<br>`pending` -> `partial` (when `balancePaise > 0` on receipt) | `overdue` (evaluated dynamically in `report.service.ts`, never written to payment record) |
| **Reminder Draft** | `draft`, `approved`, `sent`, `failed`, `cancelled` | Initialized to `draft` on `addReminderDraft`<br>`draft` -> `approved` on `approveReminder` (`action: "approve"`)<br>`draft` -> `cancelled` on `approveReminder` (`action: "reject"`) | `sent`, `failed` (no notification outbox worker transitions reminder to sent or failed) |
| **Alert** | No enum. Boolean `isAcknowledged` | `isAcknowledged: false` -> `true` on `acknowledgeAlert` (`AlertService.acknowledgeAlert#L62`) | None |
| **Recommendation** | `proposed`, `accepted`, `rejected` | Initialized to `proposed` on `createRecommendation`<br>`proposed` -> `accepted` on `decideRecommendation` (`action: "accept"`)<br>`proposed` -> `rejected` on `decideRecommendation` (`action: "reject"`) | None |

