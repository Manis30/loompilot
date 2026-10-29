# Backend Current State Report - Part 2
> Scope: Sections 6 through 10. Key business flows, background queues, realtime communication, authentication, security, and the internal agent gateway.

---

## 6. Key Flows

### a. Quotation Flow
- **Initiation (`POST /api/quotations/draft`)**:
  1. Handled by `QuotationController.requestDraft` (`controllers/quotation.controller.ts#L36`).
  2. `QuotationService.requestDraft` generates sequential quotation number (`QT-XXXXX`), writes an empty quotation shell document with status `QuotationStatus.DRAFT` to MongoDB (`services/quotation.service.ts#L112-L133`).
  3. Calls `IAgentsClient.requestDraft({ tenantId, enquiryId })`.
  4. In current production wiring prior to Stage 4, `UnavailableAgentsClient` transitions the quotation immediately to `QuotationStatus.GENERATION_FAILED` with `generationError: "Agents client not connected. Ready for user retry in Stage 4."` (`integrations/agents/unavailable.agents-client.ts#L10`). The request completes without hanging and allows user retries.
- **Recalculate (`POST /api/quotations/:id/recalculate`)**:
  1. Handled by `QuotationController.recalculate` (`controllers/quotation.controller.ts#L43`).
  2. `QuotationService.recalculate` delegates input line items, margin %, and assumptions directly to `agentsClient.recalculate()`. Node executes **zero calculation formulas** (`services/quotation.service.ts#L174-L180`).
  3. The returned recalculated fields (`materialCostPaise`, `processingCostPaise`, `overheadCostPaise`, `wastageCostPaise`, `riskBufferCostPaise`, `subtotalCostPaise`, `marginPct`, `profitPaise`, `finalPricePaise`, `etaDate`, `validUntil`) are written back to MongoDB and logged to the audit repository.
- **Stored on Quotation Document**:
  `lineItems` (materialId, name, requiredQty, onHandQty, reservedQty, toPurchaseQty, unitCostPaise, totalCostPaise, supplierLeadDays), `materialCostPaise`, `processingCostPaise`, `overheadCostPaise`, `wastagePct`, `wastageCostPaise`, `riskBufferPct`, `riskBufferCostPaise`, `subtotalCostPaise`, `marginPct`, `profitPaise`, `finalPricePaise`, `etaDate`, `validUntil`, `status`, `explanation`, `assumptions`, `inputsSnapshot`, `generationError`, `approvedBy`, `approvedAt`, `sentAt`.
- **PDF Contents (`PdfMakeRenderer`)**:
  Rendered using `pdfmake` (`integrations/pdf/pdfmake.renderer.ts#L20-L92`):
  1. Header: `${APP_NAME} - Formal Quotation`
  2. Header Metadata: Quotation reference number, customer name, validity period (`validUntil`), delivery ETA (`etaDate`).
  3. Itemised Bill of Materials table: Material name, quantity, unit, unit rate (`formatINR`), and total line cost (`formatINR`).
  4. Summary calculation table: Raw material subtotal, wastage allowance with %, price-risk buffer with %, target margin with %, final quotation price.
  5. Advisory section: Plain-language explanation and working assumptions.
  6. Advisory footer notice: Requiring customer written sign-off.
- **The "Send" Action (`POST /api/quotations/:id/send`)**:
  `QuotationService.send` compiles quotation data, invokes `pdfRenderer.renderQuotation(pdfData)`, updates quotation status in MongoDB to `QuotationStatus.SENT`, logs `QUOTATION_SENT` in the audit ledger, and returns `{ quotation, pdfBuffer }` (`services/quotation.service.ts#L245-L297`). **Does not automatically email or SMS the customer**; sends the binary PDF stream back in the HTTP response.

### b. Order Confirmation Flow (`POST /api/quotations/:id/confirm`)
Executed within a strict MongoDB session transaction via `IUnitOfWork` (`services/quotation.service.ts#L307-L427`):
1. Verifies quotation exists and has not already been confirmed (`quote.status !== QuotationStatus.CONFIRMED`).
2. Iterates over line items: for materials with `onHandQty > 0`, computes `reserveQty = Math.min(item.onHandQty, item.requiredQty)`, writes a new `Reservation` record with status `reserved`, increments `Material.reservedQuantity` by `reserveQty`, and writes an immutable audit record to `StockMovement` (`referenceType: "reservation"`).
3. Fetches sequenced processes via `ProcessRepository.listAllOrdered`.
4. Derives production plan: stages 5-day sequential intervals per process:
   - `totalQty = quote.inputsSnapshot?.targetQty || 1000`
   - `startDate = Date() + (index * 5 days)`
   - `endDate = startDate + 5 days`
   - `dailyTarget = Math.round(totalQty / 5)`
5. Creates a `ProductionOrder` record with status `OrderStatus.PLANNED` and the generated plan.
6. Updates quotation status to `QuotationStatus.CONFIRMED`.
7. Writes audit log entry `QUOTATION_CONFIRMED`.

### c. Daily Output Entry Flow (`POST /api/workforce/daily-outputs`)
1. Validates body against `RecordDailyOutputSchema` (`validators/workforce.validator.ts#L22-L30`).
2. Handled in transaction via `IUnitOfWork` (`services/workforce.service.ts#L79-L112`):
   - **Idempotency Check**: Queries `findDailyOutputByIdempotencyKey(actor.tenantId, input.idempotencyKey)`. If found, returns the existing record immediately without inserting or firing triggers.
   - **Compound Upsert**: If new, upserts record on `{ tenantId, orderId, processId, date }`.
3. **Event Trigger**: If and only if a new record was inserted (`isNewRecord === true`), executes `monitoringTrigger(tenantId, orderId)` to dispatch a debounced monitoring job (`services/workforce.service.ts#L115-L117`).
4. Writes audit entry `DAILY_OUTPUT_RECORDED`.

### d. Monitoring Flow
1. **Creation**: Alerts are created via `/internal/alerts` ingested by `AgentGatewayController.ingestAlert` (`controllers/agent-gateway.controller.ts#L32`), delegating to `AlertService.createAlert`.
2. **Deduplication**: Ingested via `MongoAlertRepository.upsertAlert` (`repositories/alert.repository.ts#L51-L60`) using unique compound index:
   ```ts
   { tenantId: 1, orderId: 1, processId: 1, date: 1, type: 1 }
   ```
   Updating metrics and message on duplicate instead of failing.
3. **Thresholds**: Node contains **no monitoring math or thresholds**. In Node, `metrics` (`requiredDaily`, `actualRate`, `deficitQty`, `delayDaysEstimated`) are accepted and stored directly from the Python monitoring agent.
4. **Realtime Push**: Immediately broadcasts the alert via Socket.IO (`realtime/socket.ts#L112-L128`) to rooms `tenant:${tenantId}:role:owner` and `tenant:${tenantId}:role:manager`.

### e. Delivery Flow (`POST /api/deliveries`)
1. Handled in transaction via `IUnitOfWork` (`services/delivery.service.ts#L42-L107`).
2. Validates order existence: `const order = await orderRepo.findById(...)`.
3. **On-Time Computation**:
   ```ts
   const deliveryDateStr = input.deliveryDate || new Date().toISOString().split("T")[0]!;
   const isOnTime = deliveryDateStr <= order.targetDeliveryDate;
   ```
4. Creates `Delivery` record with `isOnTime`, `deliveredQuantity`, and unique `deliveryNumber` and `invoiceNumber`.
5. Updates `ProductionOrder.status` to `OrderStatus.COMPLETED` and sets `actualDeliveryDate`.
6. **Payment Follow-up Trigger Condition**:
   Executes `this.deliveryTrigger(actor.tenantId, delivery)` (`services/delivery.service.ts#L101-L104`).
   **Condition**: Dispatched on **EVERY delivery**, regardless of whether `isOnTime` is `true` or `false`.

### f. Payments Flow
1. **Follow-up Creation**: Created via `POST /internal/payment-followups` or via `paymentFollowupQueue`. Initializes `Payment` document with `status = PaymentStatus.PENDING`, `balancePaise = totalInvoicePaise - amountReceivedPaise`, and default `paymentTerms: "Net 30"`.
2. **Reminder Draft Ingestion**: Created via `POST /internal/payment-reminder-drafts` (`services/payment.service.ts#L72-L92`). Adds draft reminder with `status = ReminderStatus.DRAFT`.
3. **Approval (`POST /api/payments/:id/reminders/:reminderId/approve`)**:
   - Access is restricted exclusively to `UserRole.ACCOUNTS` (`routes/payment.routes.ts#L30`).
   - If `action === "approve"`, sets `status = ReminderStatus.APPROVED`, `approvedBy = actor.userId`, `approvedAt = new Date()`.
   - If `action === "reject"`, sets `status = ReminderStatus.CANCELLED`, `failureReason = input.rejectionReason`.
4. **Post-Approval Behaviour**: Node updates the status in MongoDB and writes an audit log (`services/payment.service.ts#L120-L138`). **Does not automatically dispatch external messages** (preserves human-in-the-loop oversight).
5. **Receipt Capture (`POST /api/payments/:id/receipts`)**:
   - Computes `newBalance = Math.max(0, totalInvoicePaise - (amountReceivedPaise + paymentAmount))`.
   - Updates status: `balancePaise === 0 ? PaymentStatus.RECEIVED : PaymentStatus.PARTIAL`.

### g. Reports Flow
All reports query MongoDB and perform pure read aggregation:
1. `GET /api/reports/margin` (`services/report.service.ts#L12-L52`):
   - Access: `OWNER`, `ACCOUNTS`.
   - Fields: `totalRevenuePaise`, `totalCostPaise`, `grossMarginPaise`, `grossMarginPct`, `orderBreakdown` (each with `quotationId`, `revenuePaise`, `costPaise`, `marginPaise`, `marginPct`).
   - Computation: Sums `finalPricePaise` as revenue; sums `subtotalCostPaise + wastageCostPaise + riskBufferCostPaise` as cost; `marginPct = (margin / revenue) * 100`.
2. `GET /api/reports/on-time` (`services/report.service.ts#L54-L71`):
   - Access: `OWNER`, `MANAGER`, `SALES`.
   - Fields: `totalDeliveries`, `onTimeDeliveries`, `lateDeliveries`, `onTimeRatePct`, `averageDelayDays`.
   - Computation: Counts deliveries where `isOnTime === true`; `onTimeRatePct = (onTimeDeliveries / total) * 100`. `averageDelayDays` is a hardcoded placeholder (`lateDeliveries > 0 ? 3.5 : 0`) (**STUB**).
3. `GET /api/reports/collections` (`services/report.service.ts#L73-L106`):
   - Access: `OWNER`, `ACCOUNTS`.
   - Fields: `totalInvoicedPaise`, `totalCollectedPaise`, `totalOutstandingPaise`, `totalOverduePaise`, `agingSummary` (`currentPaise`, `days1To30Paise`, `days31To60Paise`, `days61PlusPaise`).
   - Computation: Sums `totalInvoicePaise`, `amountReceivedPaise`, and `balancePaise`. If `p.dueDate < today && balance > 0`, adds to `totalOverduePaise`. `days1To30Paise` equals `totalOverduePaise`; buckets 31-60 and 61+ are `0` (**STUB**).

---

## 7. Background Jobs and Notifications

### Queue Implementation
- **Active Implementation**: `InMemoryJobQueue<T>` (`jobs/queues.ts#L4-L26`).
  Implements `IJobQueue<T>` (`interfaces/job-queue.ts#L3-L9`) using in-memory handlers dispatched via Node.js `setImmediate()`.
- **Status**: **STUB**. BullMQ is declared in `package.json` (`^5.41.0`), but concrete BullMQ queue instances are deferred to Stage 6.
- **Persistence Across Restarts**: **NONE**. Jobs in memory are lost if the Node process restarts.
- **Retry and Backoff**: **NONE**. Failed job executions are logged to Pino (`logger.error`) with no retry attempts.

### Queues, Processors & Schedulers
| Queue Name | Payload Interface | Processor Function | Implementation Status |
| :--- | :--- | :--- | :--- |
| `monitoring-queue` | `MonitoringJobPayload` (`tenantId`, `orderId`) | `processMonitoringJob` (`jobs/processors.ts#L4`) | **STUB**: Logs receipt to Pino; agent invocation deferred |
| `payment-followup-queue` | `PaymentFollowupPayload` (`tenantId`, `deliveryId`) | `processPaymentFollowupJob` (`jobs/processors.ts#L12`) | **STUB**: Logs receipt to Pino; payment agent deferred |

- **Periodic Scheduler**: `JobScheduler` (`jobs/scheduler.ts#L3-L28`). Manages standing `setInterval` timers. Stopped cleanly during graceful shutdown in `server.ts#L38`.
- **Scheduled Sweeps**: `startDailySweep` (interval: 3,600,000 ms / 1 hour) configured as a backstop monitoring check.

### Notifier Interface & Implementations
All notifiers implement `INotifier` (`interfaces/notifier.ts#L11-L13`): `send(message: NotificationMessage): Promise<NotificationResult>`:
| Implementation | File Path | Mechanism | Production Readiness / Status |
| :--- | :--- | :--- | :--- |
| `EmailNotifier` | `integrations/notifier/email.notifier.ts#L5` | Wrapped in `p-retry` (3 retries). Simulates send via `logger.info` | **STUB**: No SMTP or SendGrid connection wired |
| `SmsNotifier` | `integrations/notifier/sms.notifier.ts#L5` | Wrapped in `p-retry` (3 retries). Simulates send via `logger.info` | **STUB**: No SMS/DLT provider gateway connected |
| `WhatsAppNotifier`| `integrations/notifier/whatsapp.notifier.ts#L5` | Wrapped in `p-retry` (3 retries). Simulates send via `logger.info` | **STUB**: No WhatsApp Business Cloud API webhook wired |
| `FakeNotifier` | `integrations/notifier/fake.notifier.ts#L4` | Deterministic fake for automated test suites | **MOCK / TEST ONLY**: Generates mock IDs |

- **Outbox**: **NO transactional outbox exists**. Notification dispatches are not backed by an outbox database collection.

---

## 8. Realtime (Socket.IO)

- **Handshake Authentication**: `apps/api/src/realtime/socket.ts#L58-L80`.
  Middleware verifies JWT passed either in `socket.handshake.auth.token` or `socket.handshake.headers.authorization`. Verifies token with `jwt.verify(token, env.JWT_SECRET)`. Missing or invalid tokens reject the socket connection immediately.
- **Rooms Joined on Connection** (`socket.ts#L86-L88`):
  1. `tenant:${user.tenantId}`
  2. `tenant:${user.tenantId}:role:${user.role}`
  3. `user:${user.userId}`
- **Events Emitted**:
  1. `"alert:new"`: Emitted via `broadcastAlert(tenantId, alertData)` (`socket.ts#L112-L128`). Dispatched **exclusively** to rooms `tenant:${tenantId}:role:owner` and `tenant:${tenantId}:role:manager`.
  2. Generic tenant events: Emitted via `broadcastToTenant(tenantId, event, payload)` (`socket.ts#L134-L151`).
- **Store Role Protection**:
  The `store` role is strictly excluded from receiving production alerts. When any payload is broadcast to the store role via `broadcastToTenant`, `stripFinancialsFromPayload` recursively deletes all cost and margin fields before emission.

---

## 9. Security and Auth

- **Password Hashing**: Salted bcrypt hashing via `bcryptjs.hash(password, 10)` (`services/auth.service.ts#L46`), verified with `bcryptjs.compare` (`auth.service.ts#L84`).
- **JWT Lifetimes & Claims**:
  - Access Token: Lifetime `env.JWT_EXPIRES_IN` (default `"1h"`). Claims: `{ userId, email, role, tenantId }`.
  - Refresh Token: Lifetime `env.JWT_REFRESH_EXPIRES_IN` (default `"7d"`). Claims: `{ userId, tenantId, jti }`. Each token contains a cryptographically random UUID `jti` to prevent collisions.
- **Refresh Token Storage, Rotation & Reuse Detection**:
  - Storage: Saved in `User.refreshTokens: string[]` in MongoDB (`models/user.model.ts#L29`).
  - Rotation: `AuthService.refreshToken` extracts old token, generates new rotated refresh token with fresh `jti`, removes the old token and stores the new token in the array (`services/auth.service.ts#L133-L143`).
  - Reuse Detection: If a decoded refresh token signature is valid but its string is not present in `user.refreshTokens`, throws `UnauthorizedError("Invalid refresh token (reused or revoked)")` (`services/auth.service.ts#L128-L130`).
- **Registration Access (`POST /api/auth/register`)**:
  - **Not Public**: If any user already exists for a `tenantId`, user creation is restricted exclusively to authenticated `OWNER` users of that tenant (`services/auth.service.ts#L28-L38`).
  - Bootstrap: In an uninitialized tenant with zero existing users, registration is allowed without prior authentication **only if** `role === UserRole.OWNER`.
- **Tenant Resolution**:
  - Public / Web routes: Extracted strictly from verified JWT `req.user.tenantId` in `authMiddleware` (`middleware/auth.ts#L17-L26`).
  - Internal gateway: Extracted from request payload body `tenantId` in `AgentGatewayController.getGatewayActor` (`controllers/agent-gateway.controller.ts#L14-L20`).
- **Helmet**: **NOT implemented**. `helmet` is not installed or mounted in `app.ts`.
- **CORS Configuration**: `cors({ origin: env.CORS_ORIGIN, credentials: true })` (`app.ts#L29-L33`).
- **Rate Limiting**: **NOT implemented**. No Redis or express-rate-limit middleware mounted.
- **Login Lockout**: **NOT implemented**. No failed attempt counters or lockout timeouts.
- **Secrets Handling**: Environment variables validated via Zod (`config/env.ts`). Database connection strings are masked in logs (`mongoUri.replace(/\/\/.*@/, "//***@")`).
- **Cost & Margin Masking (Store Role)**:
  - Material responses: `toMaterialResponse` (`mappers/material.mapper.ts#L16-L22`) omits `currentRatePaise` and `avgCostPaise` when role is `UserRole.STORE`.
  - Quotation responses: `toQuotationResponse` (`mappers/quotation.mapper.ts#L18-L32`) omits `materialCostPaise`, `processingCostPaise`, `overheadCostPaise`, `wastageCostPaise`, `riskBufferCostPaise`, `subtotalCostPaise`, `marginPct`, `profitPaise`, and line items' `unitCostPaise` and `totalCostPaise` when role is `UserRole.STORE`.
  - Realtime payloads: `stripFinancialsFromPayload` (`realtime/socket.ts#L17-L48`) scrubs all 14 cost/margin keys.

---

## 10. Agent Gateway

Mounted at `/internal/*` in `apps/api/src/app.ts#L51` and guarded by `serviceAuthMiddleware`.

### Service-Token Handling
Requires header `x-service-token: <INTERNAL_SERVICE_TOKEN>`. Validated using `crypto.timingSafeEqual()` to eliminate timing attack vectors (`middleware/serviceAuth.ts#L18-L32`). User JWTs are rejected on `/internal/*` routes.

### Endpoint Specifications & Schemas
| Route | Method | Request Zod Schema | Response Mapper |
| :--- | :---: | :--- | :--- |
| `/internal/quotations/drafts` | `POST` | `CreateQuotationDraftSchema` (`validators/quotation.validator.ts#L21`) | `toQuotationResponse` |
| `/internal/alerts` | `POST` | `CreateAlertSchema` (`validators/alert.validator.ts#L15`) | `toAlertResponse` |
| `/internal/recommendations` | `POST` | `CreateRecommendationSchema` (`validators/alert.validator.ts#L27`) | `toRecommendationResponse` |
| `/internal/monitoring-snapshots` | `POST` | Unvalidated generic JSON | Inline: `{ status: "recorded", timestamp: string }` |
| `/internal/payment-followups` | `POST` | `CreatePaymentFollowupSchema` (`validators/payment.validator.ts#L15`) | `toPaymentResponse` |
| `/internal/payment-reminder-drafts` | `POST` | `AddReminderDraftSchema` (`validators/payment.validator.ts#L27`) | `toPaymentResponse` |

### Example JSON Payloads
1. **`POST /internal/quotations/drafts`**:
   ```json
   {
     "tenantId": "tenant_1",
     "enquiryId": "65e0a1b2c3d4e5f6a7b8c901",
     "customerId": "65e0a1b2c3d4e5f6a7b8c902",
     "lineItems": [
       {
         "materialId": "65e0a1b2c3d4e5f6a7b8c903",
         "materialName": "Cotton Yarn 40s",
         "requiredQty": 500,
         "unit": "kg",
         "onHandQty": 200,
         "reservedQty": 0,
         "toPurchaseQty": 300,
         "unitCostPaise": 28000,
         "totalCostPaise": 14000000,
         "supplierLeadDays": 7
       }
     ],
     "materialCostPaise": 14000000,
     "processingCostPaise": 2000000,
     "overheadCostPaise": 1000000,
     "wastagePct": 2.5,
     "wastageCostPaise": 425000,
     "riskBufferPct": 5.0,
     "riskBufferCostPaise": 850000,
     "subtotalCostPaise": 18275000,
     "marginPct": 15.0,
     "profitPaise": 3225000,
     "finalPricePaise": 21500000,
     "etaDate": "2026-11-20",
     "validUntil": "2026-11-05",
     "explanation": "Calculated based on 7-day supplier lead time and current weaving rate."
   }
   ```
2. **`POST /internal/alerts`**:
   ```json
   {
     "tenantId": "tenant_1",
     "orderId": "65e0a1b2c3d4e5f6a7b8c910",
     "processId": "65e0a1b2c3d4e5f6a7b8c911",
     "date": "2026-10-28",
     "type": "output_shortfall",
     "severity": "high",
     "title": "Weaving Output Deficit",
     "message": "Daily output was 120m vs planned 200m.",
     "metrics": {
       "requiredDaily": 200,
       "actualRate": 120,
       "deficitQty": 80,
       "delayDaysEstimated": 2.5
     }
   }
   ```
3. **`POST /internal/recommendations`**:
   ```json
   {
     "tenantId": "tenant_1",
     "alertId": "65e0a1b2c3d4e5f6a7b8c920",
     "orderId": "65e0a1b2c3d4e5f6a7b8c910",
     "title": "Weaving Recovery Options",
     "explanation": "Adding workers or extending shift hours will catch up deficit.",
     "options": [
       {
         "id": "opt-1",
         "title": "Allocate 2 Additional Weavers",
         "description": "Increases daily output by 80m",
         "extraWorkersNeeded": 2,
         "revisedDailyTarget": 280,
         "projectedCatchupDays": 2,
         "additionalCostPaise": 48000
       }
     ]
   }
   ```
4. **`POST /internal/monitoring-snapshots`**:
   ```json
   {
     "tenantId": "tenant_1",
     "orderId": "65e0a1b2c3d4e5f6a7b8c910",
     "snapshotDate": "2026-10-28",
     "metrics": { "cumulativeOutput": 450, "targetDeficit": 50 }
   }
   ```
5. **`POST /internal/payment-followups`**:
   ```json
   {
     "tenantId": "tenant_1",
     "deliveryId": "65e0a1b2c3d4e5f6a7b8c930",
     "orderId": "65e0a1b2c3d4e5f6a7b8c910",
     "customerId": "65e0a1b2c3d4e5f6a7b8c902",
     "invoiceNumber": "INV-2026-0001",
     "totalInvoicePaise": 21500000,
     "amountReceivedPaise": 0,
     "dueDate": "2026-11-28",
     "paymentTerms": "Net 30"
   }
   ```
6. **`POST /internal/payment-reminder-drafts`**:
   ```json
   {
     "tenantId": "tenant_1",
     "paymentId": "65e0a1b2c3d4e5f6a7b8c940",
     "reminderNumber": 1,
     "channel": "email",
     "recipient": "finance@customer.com",
     "subject": "Invoice INV-2026-0001 Payment Reminder",
     "messageBody": "Dear Customer, your invoice is due on 2026-11-28.",
     "scheduledDate": "2026-11-25"
   }
   ```

### Collections & Fields Codebase Assumes Agents Read
Via direct MongoDB read-only connection (`MONGODB_RO_URI`):
- `enquiries`: `rawText`, `parsedRequirements`, `customerId`, `tenantId`.
- `materials`: `code`, `name`, `onHandQuantity`, `reservedQuantity`, `currentRatePaise`, `avgCostPaise`.
- `suppliers`: `leadTimeDays`, `suppliedMaterials`, `rating`.
- `processes`: `sequence`, `standardWastagePct`, `avgOutputPerWorkerHour`.
- `workers`: `skillLevel`, `hourlyRatePaise`, `active`.
- `attendances`: `isPresent`, `hoursWorked`, `date`.
- `dailyoutputs`: `orderId`, `processId`, `date`, `quantityProduced`, `quantityDefective`.
- `productionorders`: `orderNumber`, `plan`, `totalQuantity`, `startDate`, `targetDeliveryDate`.
- `deliveries`: `deliveryDate`, `invoiceNumber`, `totalInvoicePaise`, `isOnTime`.
- `payments`: `invoiceNumber`, `totalInvoicePaise`, `balancePaise`, `dueDate`.

### Node Calls to Agents (`IAgentsClient`)
Implemented in `QuotationService` (`services/quotation.service.ts`):
1. `IAgentsClient.requestDraft({ tenantId, enquiryId })`: Invoked when user requests draft from enquiry (`POST /api/quotations/draft`).
2. `IAgentsClient.recalculate({ tenantId, quotationId, lineItems, marginPct, assumptions })`: Invoked when user edits quotation line items (`POST /api/quotations/:id/recalculate`).
- **Active Status**: In production wiring, uses `UnavailableAgentsClient` (`integrations/agents/unavailable.agents-client.ts#L5`). Transitions draft to `generation_failed` and rejects recalculate with `BadRequestError` because Stage 4 real client connection is not yet wired. Tests utilize `FakeAgentsClient` (`tests/fakes/fake-agents-client.ts`).

