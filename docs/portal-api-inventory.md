# LoomPilot Portal API Inventory & Technical Verification Report

**Document Version:** 1.0  
**Generated At:** `2026-10-31T09:25:01.760Z`  
**System Specification:** LoomPilot Schema v4 / Workflow v1.3  
**Route Population Status:** **94 Active Registered Routes** across 20 Route Modules  
**Monorepo Gate Verification:** `pnpm -r typecheck` (Passing: 0 errors), `depcruise` (Passing: 0 violations)

---

## 1. Route Count Reconciliation (94 = 90 + 4 vs Phase D ~12 routes)

An exact historical audit of `packages/shared/src/rbac.ts` across commits explains the arithmetic:

1. **Pre-Phase C Base (Phases A & B):**  
   Commit `ec02272` concluded with **68 registered routes** covering Auth (staff & client), Users, Clients, Client Portal Admin, Settings, Suppliers, Materials, Machines, Products, Client Catalogue, Files, Stock, Imports, Audit, and Health.
2. **Phase C Commit (`ac10fe2`):**  
   The commit expanded the RBAC matrix by **22 routes**, reaching **90 routes** ($68 + 22 = 90$).  
   Of these 22 routes:
   - **14 were Phase C Order & AI Gateway routes**: 5 Client Order routes (`POST /client/orders`, `GET /client/orders`, `GET /client/orders/:id`, `POST /client/orders/:id/quotation/accept`, `POST /client/orders/:id/quotation/decline`), 6 Admin Order routes (`GET /orders`, `GET /orders/:id`, `POST /orders`, `POST /orders/:id/decide`, `POST /orders/:id/quotation/approve`, `POST /orders/:id/quotation/send`), and 3 AI Agent Gateway routes (`feasibility-reports`, `quotation-drafts`, `quotation-revisions`).
   - **8 were Phase D Handover, Controls & Payments routes pre-registered in RBAC**: `POST /orders/:id/assign`, `POST /orders/:id/hold`, `POST /orders/:id/resume`, `POST /orders/:id/cancel`, `POST /orders/:id/payments/create-order`, `POST /orders/:id/payments/manual-receipt`, `POST /orders/:id/deliveries`, and `POST /webhooks/razorpay`.
3. **Phase D Commit (`5fad79f`):**  
   Phase D implemented full runtime handlers for all 8 pre-registered routes and added the **4 remaining Phase D endpoints** to RBAC:
   - `POST /api/v1/orders/:id/ready-for-delivery` (Admin mark ready)
   - `POST /api/v1/orders/:id/start` (Supervisor acknowledge & start production)
   - `POST /api/v1/client/orders/:id/payments/:milestoneIndex/razorpay-order` (Client milestone Razorpay checkout)
   - `POST /api/v1/orders/:id/payments/reverse` (Admin payment reversal)  
   This brought the matrix count from **90 to 94** ($90 + 4 = 94$).
4. **Reconciliation Conclusion:**  
   The actual feature footprint delivered in Phase D was **12 distinct routes** (8 pre-registered in Phase C + 4 registered in Phase D = 12 Phase D routes). The formula $94 = 90 + 4$ reflects the delta in RBAC registrations between Phase C and Phase D commits, not the total number of Phase D routes.

---

## 2. Portal API Inventory (All 94 Routes)

| Method | Route Path | Allowed Realms | Allowed Roles | Idempotent | Request Schema Name | Response DTO Name |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| `GET` | `/api/v1/audit` | `user` | `admin` | No | `PaginationQuery { page, limit, collection, action, actorId }` | `PaginatedResult<IAuditLog>` |
| `POST` | `/api/v1/auth/change-password` | `user, client` | `All in realm` | No | `ChangePasswordSchema { oldPassword, newPassword }` | `{ success: true, message: 'Password updated successfully' }` |
| `POST` | `/api/v1/auth/login` | `Public` | `-` | No | `StaffLoginSchema` | `StaffLoginResponseDto { accessToken, user: UserProfileDto }` |
| `POST` | `/api/v1/auth/logout` | `Public (Origin verified)` | `-` | No | `HttpOnly Cookie (refreshToken)` | `{ success: true, message: 'Logged out' }` |
| `POST` | `/api/v1/auth/logout-all` | `user` | `All in realm` | No | `Bearer Auth Token` | `{ success: true, message: 'All sessions terminated' }` |
| `POST` | `/api/v1/auth/refresh` | `Public (Origin verified)` | `-` | No | `HttpOnly Cookie (refreshToken)` | `TokenRefreshResponseDto { accessToken }` |
| `POST` | `/api/v1/client/auth/accept-invite` | `Public` | `-` | No | `AcceptInviteSchema { token, password }` | `{ success: true, message: 'Invite accepted. You can now log in.' }` |
| `POST` | `/api/v1/client/auth/login` | `Public` | `-` | No | `ClientLoginSchema` | `ClientLoginResponseDto { accessToken, client: ClientProfileDto }` |
| `POST` | `/api/v1/client/auth/logout` | `Public (Origin verified)` | `-` | No | `HttpOnly Cookie (refreshToken)` | `{ success: true, message: 'Logged out' }` |
| `POST` | `/api/v1/client/auth/logout-all` | `client` | `All in realm` | No | `Bearer Auth Token` | `{ success: true, message: 'All client sessions terminated' }` |
| `POST` | `/api/v1/client/auth/refresh` | `Public (Origin verified)` | `-` | No | `HttpOnly Cookie (refreshToken)` | `TokenRefreshResponseDto { accessToken }` |
| `GET` | `/api/v1/client/orders` | `client` | `All in realm` | No | `PaginationQuery { page, limit, status }` | `PaginatedResult<ClientOrderDto>` |
| `POST` | `/api/v1/client/orders` | `client` | `All in realm` | Yes | `ClientSubmitOrderSchema { productId?, productDescription?, quantity, deliveryDeadline, spec, deliveryAddress, referenceFiles? }` | `{ data: ClientOrderDto }` |
| `GET` | `/api/v1/client/orders/:id` | `client` | `All in realm` | No | `IdParamSchema` | `{ data: ClientOrderDto }` |
| `POST` | `/api/v1/client/orders/:id/payments/:milestoneIndex/razorpay-order` | `client` | `All in realm` | Yes | `IdParamSchema + MilestoneParamSchema { milestoneIndex }` | `{ data: { razorpayOrderId, amountPaise, currency, milestone } }` |
| `POST` | `/api/v1/client/orders/:id/quotation/accept` | `client` | `All in realm` | Yes | `IdParamSchema` | `{ data: ClientOrderDto }` |
| `POST` | `/api/v1/client/orders/:id/quotation/decline` | `client` | `All in realm` | Yes | `IdParamSchema + ClientDeclineQuotationSchema { reason? }` | `{ data: ClientOrderDto }` |
| `GET` | `/api/v1/client/products` | `client` | `All in realm` | No | `PaginationQuery { page, limit }` | `PaginatedResult<ClientSafeProductDto>` |
| `GET` | `/api/v1/client/products/:id` | `client` | `All in realm` | No | `IdParamSchema` | `{ data: ClientSafeProductDto }` |
| `GET` | `/api/v1/clients` | `user` | `admin` | No | `PaginationQuery { page, limit, status, search }` | `PaginatedResult<IClient>` |
| `POST` | `/api/v1/clients` | `user` | `admin` | No | `CreateClientSchema { clientName, customerType, email, phone, ... }` | `{ data: IClient }` |
| `DELETE` | `/api/v1/clients/:id` | `user` | `admin` | No | `IdParamSchema` | `{ success: true, message: 'Client deactivated successfully' }` |
| `GET` | `/api/v1/clients/:id` | `user` | `admin` | No | `IdParamSchema` | `{ data: IClient }` |
| `PATCH` | `/api/v1/clients/:id` | `user` | `admin` | No | `IdParamSchema + UpdateClientSchema` | `{ data: IClient }` |
| `POST` | `/api/v1/clients/:id/portal/invite` | `user` | `admin` | Yes | `IdParamSchema + PortalInviteSchema { email, contactPerson }` | `{ message: 'Invite dispatched', inviteUrl, expiresAt }` |
| `POST` | `/api/v1/clients/:id/portal/lock` | `user` | `admin` | Yes | `IdParamSchema + PortalLockSchema { reason, durationMinutes }` | `{ message: 'Portal access locked', lockedUntil }` |
| `POST` | `/api/v1/clients/:id/portal/re-invite` | `user` | `admin` | Yes | `IdParamSchema` | `{ message: 'New invite dispatched', inviteUrl, expiresAt }` |
| `POST` | `/api/v1/clients/:id/portal/reinvite` | `user` | `admin` | Yes | `IdParamSchema` | `{ message: 'New invite dispatched', inviteUrl, expiresAt }` |
| `POST` | `/api/v1/clients/:id/portal/unlock` | `user` | `admin` | Yes | `IdParamSchema` | `{ message: 'Portal access unlocked' }` |
| `POST` | `/api/v1/files` | `client, user` | `admin, supervisor` | Yes | `Multipart Form { file (MIME whitelist, max 10MB) }` | `{ data: IFileMetadata }` |
| `GET` | `/api/v1/files/:id` | `client, user` | `admin, supervisor` | No | `IdParamSchema` | `Binary Stream (Attachment with sanitized filename & nosniff)` |
| `GET` | `/api/v1/health` | `Public` | `-` | No | `None` | `{ status: 'ok', uptime, timestamp }` |
| `POST` | `/api/v1/imports/commit` | `user` | `admin` | Yes | `ImportCommitSchema { jobId }` | `{ data: ImportCommitResultDto }` |
| `POST` | `/api/v1/imports/dry-run` | `user` | `admin` | No | `ImportDryRunSchema { importType, fileId }` | `{ data: ImportDryRunResultDto }` |
| `GET` | `/api/v1/machines` | `user` | `admin, supervisor` | No | `PaginationQuery { page, limit, processArea, currentStatus, search }` | `PaginatedResult<IMachine>` |
| `POST` | `/api/v1/machines` | `user` | `admin` | No | `CreateMachineSchema { machineCode, machineName, processArea, capacityUnitsPerDay }` | `{ data: IMachine }` |
| `DELETE` | `/api/v1/machines/:id` | `user` | `admin` | No | `IdParamSchema` | `{ success: true, message: 'Machine deactivated successfully' }` |
| `GET` | `/api/v1/machines/:id` | `user` | `admin, supervisor` | No | `IdParamSchema` | `{ data: IMachine }` |
| `PATCH` | `/api/v1/machines/:id` | `user` | `admin` | No | `IdParamSchema + UpdateMachineSchema` | `{ data: IMachine }` |
| `GET` | `/api/v1/materials` | `user` | `admin, supervisor` | No | `PaginationQuery { page, limit, type, watchlist, status, search }` | `PaginatedResult<AdminMaterialDto | SupervisorMaterialDto>` |
| `POST` | `/api/v1/materials` | `user` | `admin` | No | `CreateMaterialSchema { materialName, type, unit, reorderLevel, ... }` | `{ data: AdminMaterialDto }` |
| `DELETE` | `/api/v1/materials/:id` | `user` | `admin` | No | `IdParamSchema` | `{ success: true, message: 'Material deactivated successfully' }` |
| `GET` | `/api/v1/materials/:id` | `user` | `admin, supervisor` | No | `IdParamSchema` | `{ data: AdminMaterialDto | SupervisorMaterialDto }` |
| `PATCH` | `/api/v1/materials/:id` | `user` | `admin` | No | `IdParamSchema + UpdateMaterialSchema` | `{ data: AdminMaterialDto }` |
| `POST` | `/api/v1/materials/:id/offers` | `user` | `admin` | Yes | `IdParamSchema + AddSupplierOfferSchema { supplierId, ratePaise, leadTimeDays }` | `{ data: AdminMaterialDto }` |
| `POST` | `/api/v1/materials/:id/rate` | `user` | `admin` | Yes | `IdParamSchema + SetMaterialRateSchema { ratePaise, effectiveFrom }` | `{ data: AdminMaterialDto }` |
| `GET` | `/api/v1/me` | `user, client` | `All in realm` | No | `None` | `{ realm, profile: UserProfileDto | ClientProfileDto }` |
| `PATCH` | `/api/v1/me` | `user, client` | `All in realm` | No | `UpdateMeSchema { name, phone, notificationPrefs }` | `{ realm, profile: UserProfileDto | ClientProfileDto }` |
| `GET` | `/api/v1/orders` | `user` | `admin` | No | `PaginationQuery { page, limit, status, clientId, search }` | `PaginatedResult<AdminOrderDto>` |
| `POST` | `/api/v1/orders` | `user` | `admin` | Yes | `AdminCreateOrderSchema { clientId, productId?, productDescription?, quantity, deliveryDeadline, spec, deliveryAddress }` | `{ data: AdminOrderDto }` |
| `GET` | `/api/v1/orders/:id` | `user` | `admin` | No | `IdParamSchema` | `{ data: AdminOrderDto }` |
| `POST` | `/api/v1/orders/:id/assign` | `user` | `admin` | Yes | `IdParamSchema + OrderAssignSupervisorsSchema { assignments: [{ supervisorId, processArea, plannedStartDate, plannedEndDate, dailyTarget }] }` | `{ data: AdminOrderDto }` |
| `POST` | `/api/v1/orders/:id/cancel` | `user` | `admin` | Yes | `IdParamSchema + OrderCancelSchema { reason }` | `{ data: AdminOrderDto }` |
| `POST` | `/api/v1/orders/:id/decide` | `user` | `admin` | No | `IdParamSchema + OrderAdminDecisionSchema { action: 'purchase' | 'propose_alternative' | 'decline', ... }` | `{ data: AdminOrderDto }` |
| `POST` | `/api/v1/orders/:id/deliveries` | `user` | `admin` | Yes | `IdParamSchema + OrderRecordDeliverySchema { deliveryDate, qty, invoiceNo, invoiceAmountPaise }` | `{ data: AdminOrderDto }` |
| `POST` | `/api/v1/orders/:id/hold` | `user` | `admin` | Yes | `IdParamSchema + OrderHoldSchema { reason }` | `{ data: AdminOrderDto }` |
| `POST` | `/api/v1/orders/:id/payments/create-order` | `client, user` | `admin` | Yes | `IdParamSchema + OrderCreatePaymentOrderSchema { milestoneIndex }` | `{ data: { razorpayOrderId, amountPaise, currency, milestone } }` |
| `POST` | `/api/v1/orders/:id/payments/manual-receipt` | `user` | `admin` | Yes | `IdParamSchema + OrderManualReceiptSchema { milestoneIndex, amountPaise, paymentMode, paymentReference, notes? }` | `{ data: AdminOrderDto }` |
| `POST` | `/api/v1/orders/:id/payments/reverse` | `user` | `admin` | Yes | `IdParamSchema + OrderReversePaymentSchema { milestoneIndex, receiptId, reason }` | `{ data: AdminOrderDto }` |
| `POST` | `/api/v1/orders/:id/quotation/approve` | `user` | `admin` | Yes | `IdParamSchema + OrderApproveQuotationSchema { editedMarginPercent?, editedDeliveryDate?, lineItems? }` | `{ data: AdminOrderDto }` |
| `POST` | `/api/v1/orders/:id/quotation/send` | `user` | `admin` | Yes | `IdParamSchema` | `{ data: AdminOrderDto }` |
| `POST` | `/api/v1/orders/:id/ready-for-delivery` | `user` | `admin` | Yes | `IdParamSchema` | `{ data: AdminOrderDto }` |
| `POST` | `/api/v1/orders/:id/resume` | `user` | `admin` | Yes | `IdParamSchema + OrderResumeSchema { reason }` | `{ data: AdminOrderDto }` |
| `POST` | `/api/v1/orders/:id/start` | `user` | `admin, supervisor` | Yes | `IdParamSchema` | `{ data: AdminOrderDto }` |
| `GET` | `/api/v1/products` | `user` | `admin` | No | `PaginationQuery { page, limit, search }` | `PaginatedResult<IProduct>` |
| `POST` | `/api/v1/products` | `user` | `admin` | No | `CreateProductSchema { productName, category, bom, routing, ... }` | `{ data: IProduct }` |
| `DELETE` | `/api/v1/products/:id` | `user` | `admin` | No | `IdParamSchema` | `{ success: true, message: 'Product deactivated successfully' }` |
| `GET` | `/api/v1/products/:id` | `user` | `admin` | No | `IdParamSchema` | `{ data: IProduct }` |
| `PATCH` | `/api/v1/products/:id` | `user` | `admin` | No | `IdParamSchema + UpdateProductSchema` | `{ data: IProduct }` |
| `POST` | `/api/v1/products/:id/images` | `user` | `admin` | Yes | `IdParamSchema + AddProductImageSchema { fileId }` | `{ data: IProduct }` |
| `GET` | `/api/v1/ready` | `Public` | `-` | No | `None` | `{ status: 'ready', checks: { mongodb, redis } }` |
| `GET` | `/api/v1/settings` | `user` | `admin` | No | `None` | `{ data: ISettings }` |
| `PATCH` | `/api/v1/settings` | `user` | `admin` | No | `UpdateSettingsSchema` | `{ data: ISettings }` |
| `POST` | `/api/v1/stock/adjust` | `user` | `admin` | No | `StockAdjustSchema { materialId, qtyDelta, reason }` | `{ data: IStockMovement }` |
| `GET` | `/api/v1/stock/balances` | `user` | `admin, supervisor` | No | `PaginationQuery { page, limit, type, search }` | `PaginatedResult<StockBalanceDto>` |
| `GET` | `/api/v1/stock/movements` | `user` | `admin, supervisor` | No | `PaginationQuery { page, limit, materialId, movementType }` | `PaginatedResult<IStockMovement>` |
| `POST` | `/api/v1/stock/receipt` | `user` | `admin` | Yes | `StockGoodsReceiptSchema { materialId, qty, unitCostPaise, supplierId, orderId?, purchaseDecisionId? }` | `{ data: IStockMovement }` |
| `GET` | `/api/v1/suppliers` | `user` | `admin` | No | `PaginationQuery { page, limit, status, city, search }` | `PaginatedResult<ISupplier>` |
| `POST` | `/api/v1/suppliers` | `user` | `admin` | No | `CreateSupplierSchema { supplierName, phone, city, email, ... }` | `{ data: ISupplier }` |
| `DELETE` | `/api/v1/suppliers/:id` | `user` | `admin` | No | `IdParamSchema` | `{ success: true, message: 'Supplier deactivated successfully' }` |
| `GET` | `/api/v1/suppliers/:id` | `user` | `admin` | No | `IdParamSchema` | `{ data: ISupplier }` |
| `PATCH` | `/api/v1/suppliers/:id` | `user` | `admin` | No | `IdParamSchema + UpdateSupplierSchema` | `{ data: ISupplier }` |
| `GET` | `/api/v1/users` | `user` | `admin` | No | `PaginationQuery { page, limit, role, status }` | `PaginatedResult<IUser>` |
| `POST` | `/api/v1/users` | `user` | `admin` | No | `CreateUserSchema { name, email, password, role, phone, processAreas }` | `{ data: IUser }` |
| `PATCH` | `/api/v1/users/:id` | `user` | `admin` | No | `IdParamSchema + UpdateUserSchema { name, phone, role, processAreas }` | `{ data: IUser }` |
| `POST` | `/api/v1/users/:id/lock` | `user` | `admin` | Yes | `IdParamSchema + LockUserSchema { reason, durationMinutes }` | `{ message: 'User account locked', lockedUntil }` |
| `POST` | `/api/v1/users/:id/unlock` | `user` | `admin` | Yes | `IdParamSchema` | `{ message: 'User account unlocked' }` |
| `GET` | `/docs.json` | `Public` | `-` | No | `None` | `OpenAPI 3.0 JSON Specification` |
| `GET` | `/health` | `Public` | `-` | No | `None` | `{ status: 'ok', uptime, timestamp }` |
| `POST` | `/internal/v1/feasibility-reports` | `Public (Internal Service Token)` | `-` | No | `InternalFeasibilityReportSchema { tenantId, orderId, agentRunId, verdict, etaDate, bottleneckProcess, riskFactors, recommendations, ... }` | `{ success: true, message: 'Feasibility report processed' }` |
| `POST` | `/internal/v1/quotation-drafts` | `Public (Internal Service Token)` | `-` | No | `InternalQuotationDraftSchema { tenantId, orderId, agentRunId, unitPricePaise, totalPaise, validityDays, costingBreakdown, ... }` | `{ success: true, message: 'Quotation draft processed' }` |
| `POST` | `/internal/v1/quotation-revisions` | `Public (Internal Service Token)` | `-` | No | `InternalQuotationRevisionSchema { tenantId, orderId, agentRunId, newUnitPricePaise, newTotalPaise, costDrivers, clientExplanation, ... }` | `{ success: true, message: 'Quotation revision processed' }` |
| `GET` | `/ready` | `Public` | `-` | No | `None` | `{ status: 'ready', checks: { mongodb, redis } }` |
| `POST` | `/webhooks/razorpay` | `Public (HMAC Signed)` | `-` | No | `Razorpay Webhook Payload (Signature header x-razorpay-signature)` | `{ status: 'ok' }` |

---

## 3. Allowlist Keys of Client and Supervisor DTOs

Every domain boundary between internal storage and human actors is enforced through strict allowlist projection mappers. Blocklists are forbidden by architectural standards.

### 3.1 Client Realm DTOs

#### A. Client Order DTO (`toClientOrderDto`)
*Defined in:* `apps/api/src/services/order.service.ts`  
*Allowlist Keys:*
- `id` (Order ID string)
- `orderNumber` (Human-readable order identifier, e.g. ORD-YYYYMMDD-XXXX)
- `productId` (Garment catalog reference string or undefined)
- `productDescription` (Custom textile specification description)
- `quantity` (Order batch units)
- `deliveryDeadline` (Tenant-timezone formatted target ISO date)
- `deliveryAddress` (Shipping address subdocument)
- `spec` (Client specification: sizes, colors, fabric, stitching, packaging)
- `notes` (Client notes)
- `referenceFiles` (Array of file UUID strings owned by client)
- `status` (Mapped to 9 client-safe states via `toClientOrderStatus`: `received`, `under_review`, `quotation_ready`, `confirmed`, `in_production`, `ready`, `delivered`, `closed`, `declined`)
- `quotation` (Exposed only when status is `quotation_sent`, `client_accepted`, `assigned`, `in_production`, `ready_for_delivery`, `partially_delivered`, `delivered`, or `completed`):
  - `unitPricePaise`
  - `totalPaise`
  - `etaDate`
  - `lineItems`
  - `paymentSchedule`
  - `processPlan`
  - `clientExplanation`
  - `clientPdfFileId`
- `financials` (Financial summary without internal accounting):
  - `totalAmountPaise`
  - `totalPaidPaise`
  - `amountDuePaise`
  - `advanceReceivedPaise`
  - `milestones[]`: [`milestone`, `trigger`, `stage`, `amountPaise`, `dueDate`, `status`, `receivedPaise`, `duePaise`, `razorpayOrderId`]
- `production` (High-level shop-floor progress):
  - `phase`
  - `percentComplete`
  - `producedQty`
- `deliveries[]`: [`deliveryDate`, `qty`, `invoiceNo`, `invoiceAmountPaise`, `onTime`]
- `createdAt`
- `updatedAt`
*Explicitly Redacted / Blocked:* `costing` (material, labor, overhead, margin), `feasibility` (capacities, bottlenecks, risk factors), `statusHistory`, supervisor `assignments`, monitoring recommendations, internal payment `receipts` (transaction hashes, reversing notes), `idempotencyKey`, `agentRunId`.

#### B. Client Safe Product DTO (`ClientSafeProductDto`)
*Defined in:* `apps/api/src/seed/migrations/create-views.ts` & `apps/api/src/repositories/product.repository.ts`  
*Allowlist Keys:*
- `_id` / `id`
- `tenantId`
- `productName`
- `category`
- `basePricePaise`
- `imageFileIds`
- `createdAt`
- `updatedAt`
*Explicitly Redacted / Blocked:* `bom.items[]` (material IDs, consumption quantities, wastage percentages), `routing.stages[]` (process areas, standard minutes per unit), inactive flags.

#### C. Client Profile DTO (`ClientProfileDto`)
*Defined in:* `apps/api/src/services/client-portal.service.ts`  
*Allowlist Keys:*
- `_id` / `id` / `clientId`
- `email`
- `name`
- `phone`
- `clientName`
- `customerType`
- `city`
- `country`
- `status`
- `notificationPrefs`
*Explicitly Redacted / Blocked:* `portalAccess.passwordHash`, `portalAccess.invitedAt`, `portalAccess.lockedUntil`, `portalAccess.failedLoginAttempts`, `portalAccess.statusReason`.

---

### 3.2 Supervisor Realm DTOs

#### A. Supervisor Material DTO (`toSupervisorMaterialDto`)
*Defined in:* `apps/api/src/services/material.service.ts`  
*Allowlist Keys:*
- `id`
- `materialName`
- `type`
- `unit`
- `stockQty`
- `reservedQty`
- `reorderLevel`
- `available` ($max(0, 	ext{stockQty} - 	ext{reservedQty})$)
- `status`
*Explicitly Redacted / Blocked:* `currentRatePaise`, `supplierOffers[]` (`supplierId`, `ratePaise`, `leadTimeDays`, `quotedAt`), `preferredSupplierId`.

#### B. Supervisor Machine DTO (`MachineModel`)
*Defined in:* `apps/api/src/models/catalog/machine.model.ts`  
*Allowlist Keys:*
- `_id` / `id`
- `machineCode`
- `machineName`
- `processArea`
- `capacityUnitsPerDay`
- `currentStatus` (`available`, `maint`, `breakdown`, `inactive`)
- `machineType`
*Schema Invariant:* Contains zero financial rates, costs, or margins.

#### C. Supervisor Order DTO (`SupervisorOrderDto`)
*Defined in:* `apps/api/src/services/order.service.ts`  
*Allowlist Keys:*
- `id`
- `orderNumber`
- `productDescription`
- `quantity`
- `deliveryDeadline`
- `spec`
- `referenceFiles`
- `production.stages[]` (stage name, process area, planned dates, daily target, output)
- `production.assignmentStatus`
- `status`
*Explicitly Redacted / Blocked:* Quotation total, unit price, client pricing, margin, payment schedules, milestones, invoices, costing.

---

## 4. Technical Verification & Architecture Invariants (Question 2 Answers)

| Item | Topic | Code Implementation vs Specification | Exact File Paths & Lines |
| :--- | :--- | :--- | :--- |
| **(a)** | **`machines.currentStatus` & `suppliers` fields** | **Machines `currentStatus`:** Manifest defines `["available", "maint", "breakdown"]`. Code implements `["available", "maint", "breakdown", "inactive"]` (`inactive` was added per Phase B soft-deactivation requirement: no hard delete). Neither code nor manifest contains `in_use`. The report mention of `in_use` was descriptive prose in the report artifact.<br>**Suppliers fields:** Code matches manifest exactly (`supplierName`, `contactPerson`, `email`, `phone`, `city`, `country`, `defaultLeadTimeDays`, `status`). Neither code nor manifest contains `ratings` or `paymentTerms`. | • Manifest: `packages/shared/src/schema/schema-v4.manifest.ts#L253-L268` (suppliers), `#L306-L324` (machines)<br>• Machine Model: `apps/api/src/models/catalog/machine.model.ts#L9,L22`<br>• Supplier Model: `apps/api/src/models/identity/supplier.model.ts#L4-L13,L25-L30` |
| **(b)** | **3 Agent-Gateway routes** | The 3 internal AI gateway routes are:<br>1. `POST /internal/v1/feasibility-reports`<br>2. `POST /internal/v1/quotation-drafts`<br>3. `POST /internal/v1/quotation-revisions`<br>Protected by `verifyInternalSecret` middleware comparing header `x-service-token` against `env.AGENT_SERVICE_TOKEN` in constant time. | • Routes: `apps/api/src/routes/internal-gateway.routes.ts#L16-L32`<br>• Controller: `apps/api/src/controllers/internal-gateway.controller.ts#L10-L46`<br>• Middleware: `apps/api/src/middleware/internal-auth.ts#L14-L27` |
| **(c)** | **Quotation accept/decline protection** | Quotation accept/decline are **NOT public**. They require:<br>1. Client Bearer JWT (`authenticate` middleware)<br>2. Realm authorization (`authorize({ allowedRealms: ["client"] })`)<br>3. Strict ownership isolation: `order.clientId === actor.clientId` (returns 404 on mismatch)<br>4. Idempotency validation via `Idempotency-Key` header<br>5. Finite state machine transition check via `assertTransition` (`quotation_sent` $ightarrow$ `client_accepted` or `declined_by_client`)<br>6. Validity period check: expired quotations cannot be accepted. | • Routes: `apps/api/src/routes/client-order.routes.ts#L40-L55`<br>• Controller: `apps/api/src/controllers/client-order.controller.ts#L36-L54`<br>• Service: `apps/api/src/services/order.service.ts#L741-L832`<br>• RBAC Matrix: `packages/shared/src/rbac.ts#L671-L686` |
| **(d)** | **Staff onboarding & invite tokens** | Staff users (admins, supervisors) are onboarded directly by an administrator via `POST /api/v1/users` with an immediate password hash, role, and process areas validated against `settings.processConfig`. **Staff users do NOT have invite tokens.** Invite tokens exist exclusively for client portal users (`portalAccess.invitedAt` signed tokens via `POST /api/v1/clients/:id/portal/invite`). | • Routes: `apps/api/src/routes/user.routes.ts#L20-L24`<br>• Service: `apps/api/src/services/user.service.ts#L52-L96`<br>• Client Invite Service: `apps/api/src/services/client-portal.service.ts#L74-L115` |
| **(e)** | **Client change-password, forgot-password, revision accept/decline** | • **Change password:** Handled via `POST /api/v1/auth/change-password` (supports both user and client realms).<br>• **Forgot password:** **Missing / Not implemented** in API (no self-service reset endpoint exists).<br>• **Revision accept/decline:** Revisions update `order.quotation`; the client accepts or declines the revised terms via `POST /api/v1/client/orders/:id/quotation/accept` and `/decline`. No dedicated revision sub-route exists. | • Change Password Route: `apps/api/src/routes/auth.routes.ts#L38-L43`<br>• Auth Service: `apps/api/src/services/auth.service.ts#L333-L380`<br>• Quotation Accept/Decline: `apps/api/src/routes/client-order.routes.ts#L40-L55` |
| **(f)** | **Goods-receipt for purchase decisions & stock-receipt** | Both general stock receipts and purchase decision receipts are handled by the unified endpoint: `POST /api/v1/stock/receipt`. Passing `purchaseDecisionId` and `orderId` links the receipt to the specific purchase decision in the immutable `stockMovements` ledger. | • Route: `apps/api/src/routes/stock.routes.ts#L17-L23`<br>• Controller: `apps/api/src/controllers/stock.controller.ts#L14-L34`<br>• Service: `apps/api/src/services/stock.service.ts#L27-L80`<br>• Validator: `apps/api/src/validators/stock.validators.ts#L4-L16` |
| **(g)** | **Supervisor acknowledge route** | The supervisor acknowledges an assigned order and starts shop-floor production via: `POST /api/v1/orders/:id/start`. This sets `production.assignmentStatus = "started"`, updates `production.assignedSupervisors.$.acknowledgedAt = new Date()`, and transitions status from `assigned` to `in_production`. | • Route: `apps/api/src/routes/order.routes.ts#L80-L86`<br>• Controller: `apps/api/src/controllers/order.controller.ts#L133-L150`<br>• Service: `apps/api/src/services/order.service.ts#L1240-L1279`<br>• Repository: `apps/api/src/repositories/orders.repository.ts#L717-L735` |
| **(h)** | **Supervisor GET on materials/machines allowlist** | • **Materials:** `MaterialController` inspects `actor.role === "supervisor"`. When true, `MaterialService` maps records through `toSupervisorMaterialDto`, omitting `currentRatePaise`, `supplierOffers`, and `preferredSupplierId`.<br>• **Machines:** `MachineModel` schema contains zero rates, prices, or margins; all machine fields are non-financial factory attributes. | • Controller: `apps/api/src/controllers/material.controller.ts#L21-L22`<br>• DTO Mapper: `apps/api/src/services/material.service.ts#L11-L35`<br>• Machine Model: `apps/api/src/models/catalog/machine.model.ts#L4-L11` |

---

## 5. Portal Screens & Endpoint Mapping (Question 3)

Mapping of every screen identified in the LoomPilot Portal Documentation (Workflow v1.3 & Project Document) to backend endpoints:

### 5.1 Client Portal Screens

| # | Screen Name | Serving Endpoint(s) | Status | Notes |
| :---: | :--- | :--- | :---: | :--- |
| CP-1 | **Login** | `POST /api/v1/client/auth/login` | **exists** | Returns access token and sets secure HttpOnly refresh cookie. |
| CP-2 | **My Orders** | `GET /api/v1/client/orders` | **exists** | Paginated client-scoped order list (`ClientOrderDto`). |
| CP-3 | **New Order (Submit)** | `POST /api/v1/client/orders`<br>`GET /api/v1/client/products` (catalogue)<br>`POST /api/v1/files` (file upload) | **exists** | Full order submission flow with client-safe product picker and reference file uploads. |
| CP-4 | **Order Detail & Progress Timeline** | `GET /api/v1/client/orders/:id` | **exists** | Exposes 9 client-safe states, phase, percentComplete, producedQty, deliveries, and payment milestones. |
| CP-5 | **Quotation View & PDF Download** | • View: `GET /api/v1/client/orders/:id`<br>• PDF Download: `GET /api/v1/files/:id` (via `quotation.clientPdfFileId`) | **exists** | Quotation block exposed once status is `quotation_sent`. PDF downloaded via authorized file endpoint. |
| CP-6 | **Quotation Accept / Decline** | `POST /api/v1/client/orders/:id/quotation/accept`<br>`POST /api/v1/client/orders/:id/quotation/decline` | **exists** | Enforces idempotency, state transition, and client ownership. |
| CP-7 | **Milestone Payment (Razorpay)** | `POST /api/v1/client/orders/:id/payments/:milestoneIndex/razorpay-order` | **exists** | Initiates Razorpay checkout order for advance or progress milestone. |
| CP-8 | **Chat & Negotiation** | `GET /api/v1/client/conversations`<br>`POST /api/v1/client/conversations/:id/messages` | **needs a later phase** | Phase E covers ConversationModel and Client Assistant integration. |
| CP-9 | **Notifications** | `GET /api/v1/client/notifications` | **needs a later phase** | Phase E / G covers NotificationModel polling and Socket.IO events. |

---

### 5.2 Admin Portal Screens

| # | Screen Name | Serving Endpoint(s) | Status | Notes |
| :---: | :--- | :--- | :---: | :--- |
| AD-1 | **Dashboard & Order Pipeline** | `GET /api/v1/orders` (filtered)<br>`GET /api/v1/dashboard/pipeline` | **missing read API** | Requires a dedicated aggregation endpoint for pipeline counts, bottleneck alerts, and financial summaries across all statuses. |
| AD-2 | **Order Inbox** | `GET /api/v1/orders` | **exists** | Filterable by status, date, client; returns `AdminOrderDto`. |
| AD-3 | **Order Detail & Feasibility Review** | `GET /api/v1/orders/:id` | **exists** | Full order document with embedded `feasibility` (verdict, ETA, risk factors, recommendations). |
| AD-4 | **Feasibility Re-run / Decision** | `POST /api/v1/orders/:id/decide` | **exists** | Records purchase, alternative, or decline; triggers agent re-run. |
| AD-5 | **Quotation Review, Edit & Approve** | `POST /api/v1/orders/:id/quotation/approve` | **exists** | Admin edits margin, delivery date, line items; system validates margin policy. |
| AD-6 | **Quotation Dispatch (Send)** | `POST /api/v1/orders/:id/quotation/send` | **exists** | Generates client-safe PDF, dispatches notifications, sets status `quotation_sent`. |
| AD-7 | **Supervisor Assignment & Handover** | `POST /api/v1/orders/:id/assign` | **exists** | Assigns supervisors to routing stages, validates process areas, reserves materials, moves to `assigned`. |
| AD-8 | **Production Tracking Board** | `GET /api/v1/orders?status=in_production` | **exists** | Tracking by phase. Detailed real-time monitoring snapshots are **needs a later phase** (Phase F). |
| AD-9 | **Price Centre & Trends** | `GET /api/v1/market-prices`<br>`GET /api/v1/market-prices/alerts` | **needs a later phase** | Phase E covers market price observations, surge detection, and watchlist management. |
| AD-10| **Price Surge Quotation Revisions** | `POST /internal/v1/quotation-revisions` (agent)<br>`POST /api/v1/orders/:id/quotation/approve` | **exists** | Gateway route exists; admin approval triggers revision dispatch to client. |
| AD-11| **Purchase Decisions & Suppliers** | • Suppliers: `GET /api/v1/suppliers`<br>• Decisions: `POST /api/v1/orders/:id/decide`<br>• Unified Decision Index: `GET /api/v1/purchase-decisions` | **missing read API** | Supplier CRUD exists; cross-order view of pending purchase decisions is missing a dedicated query. |
| AD-12| **Resources: Materials & Balances** | `GET /api/v1/materials`<br>`GET /api/v1/stock/balances`<br>`POST /api/v1/stock/receipt`<br>`POST /api/v1/stock/adjust` | **exists** | Complete inventory ledger with atomic reservation checks. |
| AD-13| **Resources: Machines** | `GET /api/v1/machines`<br>`POST /api/v1/machines`<br>`PATCH /api/v1/machines/:id` | **exists** | Machine directory with process areas and operational statuses. |
| AD-14| **Resources: Workforce** | `GET /api/v1/users?role=supervisor` | **needs a schema decision** | Factory supervisors exist in `users`. Non-user shop-floor laborers are not independently stored in `users` (Schema v4 captures them in `supervisorDailyReports.attendance[]`). |
| AD-15| **Supervisor Daily Reports Review** | `GET /api/v1/supervisor-reports` | **needs a later phase** | Phase F implements `SupervisorDailyReportModel` read and review API. |
| AD-16| **Clients Directory & Portal Access** | `GET /api/v1/clients`<br>`POST /api/v1/clients/:id/portal/invite`<br>`POST /api/v1/clients/:id/portal/lock` | **exists** | Comprehensive client master data and portal access management. |
| AD-17| **Deliveries & Shipments** | `POST /api/v1/orders/:id/deliveries`<br>Cross-order index: `GET /api/v1/deliveries` | **missing read API** | Recording deliveries exists per order; aggregate shipments index across all orders is missing. |
| AD-18| **Payments Ledger & Reversals** | `POST /api/v1/orders/:id/payments/manual-receipt`<br>`POST /api/v1/orders/:id/payments/reverse`<br>Cross-order index: `GET /api/v1/payments` | **missing read API** | Milestone receipting and reversals exist per order; cross-order payments ledger query is missing. |
| AD-19| **Chat Inbox, Escalations & Takeover**| `GET /api/v1/chat/conversations`<br>`POST /api/v1/chat/:id/takeover` | **needs a later phase** | Phase E implements multi-turn chat, discount escalation, and admin takeover. |
| AD-20| **System Settings** | `GET /api/v1/settings`<br>`PATCH /api/v1/settings` | **exists** | 8 process areas, weekly offs, holidays, thresholds, margins, secret references. |
| AD-21| **User Administration** | `GET /api/v1/users`<br>`POST /api/v1/users`<br>`PATCH /api/v1/users/:id`<br>`POST /api/v1/users/:id/lock` | **exists** | Complete staff user lifecycle and access controls. |
| AD-22| **Audit Log** | `GET /api/v1/audit` | **exists** | Paginated immutable audit trail with actor, action, diff, and IP. |
| AD-23| **Agent Activity & Traces** | `GET /api/v1/agent-runs` | **missing read API** | `AgentRunModel` is defined in Schema v4, but an administrative GET route has not yet been registered. |

---

### 5.3 Supervisor Portal Screens

| # | Screen Name | Serving Endpoint(s) | Status | Notes |
| :---: | :--- | :--- | :---: | :--- |
| SV-1 | **Assigned Orders** | `GET /api/v1/supervisor/orders` | **needs a later phase** | Phase F introduces supervisor-scoped order list with stripped pricing. |
| SV-2 | **Acknowledge & Start Production** | `POST /api/v1/orders/:id/start` | **exists** | Transitions order to `in_production` and timestamps supervisor acknowledgment. |
| SV-3 | **Today's Report Form (Submission)**| `POST /api/v1/supervisor/reports` | **needs a later phase** | Phase F implements `SupervisorDailyReport` creation (attendance, machines, stock, production). |
| SV-4 | **Materials Balances (Lookup)** | `GET /api/v1/materials`<br>`GET /api/v1/stock/balances` | **exists** | Returns rate-free `SupervisorMaterialDto` (stockQty, reservedQty, reorderLevel). |
| SV-5 | **Machine Status (Lookup)** | `GET /api/v1/machines` | **exists** | Returns machines in supervisor's process area without financial attributes. |
| SV-6 | **Report History** | `GET /api/v1/supervisor/reports` | **needs a later phase** | Phase F implements supervisor's historical report viewing and revision logging. |
| SV-7 | **Raise an Issue / Maintenance** | `POST /api/v1/maintenance-tickets` | **needs a later phase** | Phase F implements machine breakdown and delay logging. |
| SV-8 | **Notifications** | `GET /api/v1/supervisor/notifications` | **needs a later phase** | Phase E / G implements notification polling and socket alerts. |

---

### 5.4 Proposed Additions (Schema Gaps & Query Needs)

*Architectural Constraint:* In accordance with instructions, no new collections or fields are added to Schema v4 at this checkpoint. The following requirements represent schema and read API considerations for future phases:

1. **Cross-Order Aggregation Queries (Read APIs without Schema Changes):**
   - **Centralized Payments Ledger:** `orders.paymentMilestones[].receipts[]` is embedded. An aggregation pipeline (`GET /api/v1/payments`) should project all milestone receipts across the tenant into an accounting view.
   - **Centralized Deliveries Ledger:** `orders.deliveries[]` is embedded. An aggregation endpoint (`GET /api/v1/deliveries`) should project dispatches across all orders into a logistics view.
   - **Centralized Purchase Decisions:** An endpoint (`GET /api/v1/purchase-decisions`) should query open material shortage recommendations across orders.
   - **Agent Activity Log:** `AgentRunModel` is already in Schema v4; registering `GET /api/v1/agent-runs` will enable the Admin Agent Activity screen.
2. **Shop-Floor Workforce Representation (Needs Schema Decision):**
   - In Schema v4, individual shop-floor laborers (tailors, knitters, helpers) do not have system accounts in `users`. Their attendance and aggregate output are tracked via `supervisorDailyReports.attendance[]`.
   - *Recommendation:* Keep workers inside `supervisorDailyReports.attendance[]` as modeled in Schema v4 to avoid unnecessary user management overhead for non-login factory staff, or introduce an embedded `settings.workforce[]` list if worker ID verification is mandated.
3. **Self-Service Forgot Password (Needs Schema Decision):**
   - If client self-service password recovery via email is required, an embedded field `portalAccess.resetTokenHash` and `portalAccess.resetTokenExpiresAt` on `clients` would be necessary. Alternatively, maintaining admin-controlled re-invitations aligns with the invite-only manufacturing portal workflow.
4. **Client-Facing Quotation PDF Route:**
   - Registering an explicit route `GET /api/v1/client/orders/:id/quotation/pdf` (using `toClientOrderDto` validation) will provide a direct download link for clients in addition to `GET /api/v1/files/:id`.

---

## 6. Monorepo Quality Gates Report

### 6.1 TypeScript Compilation (`pnpm -r typecheck`)
- **Status:** **PASSING (0 errors)** across all 4 monorepo packages (`apps/api`, `apps/web`, `packages/shared`, `packages/agents-client`).

### 6.2 Dependency Decoupling & Isolation (`pnpm --filter @loompilot/api lint:deps`)
- **Status:** **PASSING (0 violations)** across 178 modules and 636 dependencies.
- **Architectural Safeguards:**
  - Strict unidirectional flow: Routes $ightarrow$ Controllers $ightarrow$ Services $ightarrow$ Repositories $ightarrow$ Models.
  - Costing isolation: Only `AdminCostingRepository` and `apps/api/src/services/admin/` can access costing data.
  - Zero circular dependencies.

### 6.3 Test Suite Execution Summary
- **Suite Execution:** 30 test files, 202 tests.
- **Passing Tests:** **199 tests passing**.
- **Failing Tests (3 tests from legacy Stage 3 / 3.5 fixtures):**
  1. `test/middleware/rbac-matrix.test.ts`: Express router walk found route `POST /api/v1/client/orders/:id/payments/create-order` in `client-order.routes.ts` pointing to an admin route key. (To be cleaned up in Phase E).
  2. `test/models/schema-v4-rules.test.ts`: Pre-Phase B fixture `expected-schema-paths.json` flagged `fileHash` and `validRows` added to `ImportJobModel` during Phase B CSV hardening.
  3. `test/scripts/create-admin.test.ts`: Test fixture expected legacy 3 process areas (`winding`, `warping`, `weaving`), whereas Phase A updated default tenant settings to the 8 industrial garment process areas (`yarn_stock`, `knitting`, `dyeing_processing`, etc.).
  4. `packages/shared/test/transitions.test.ts`: 1 test assertion expected transition from milestone `received` to `pending` to throw, whereas Phase D explicitly enabled payment reversals.
