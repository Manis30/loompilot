// Group 1: Identity and Settings
export * from "./identity/user.model.js";
export * from "./identity/client-account.model.js";
export * from "./identity/client.model.js";
export * from "./identity/supplier.model.js";
export * from "./identity/settings.model.js";

// Group 2: Catalog and Market
export * from "./catalog/machine.model.js";
export * from "./catalog/material.model.js";
export * from "./catalog/product.model.js";
export * from "./catalog/market-source.model.js";
export * from "./catalog/price-observation.model.js";
export * from "./catalog/price-history.model.js";
export * from "./catalog/price-alert.model.js";

// Group 3: Orders
export * from "./orders/order.model.js";
export * from "./orders/feasibility-report.model.js";
export * from "./orders/quotation.model.js";
export * from "./orders/quotation-revision.model.js";

// Group 4: Admin-Only
export * from "./admin/quotation-costing.model.js";
export * from "./admin/purchase-decision.model.js";
export * from "./admin/order-assignment.model.js";
export * from "./admin/delivery.model.js";
export * from "./admin/payment.model.js";

// Group 5: Supervisor and Production
export * from "./production/supervisor-daily-report.model.js";
export * from "./production/daily-output.model.js";
export * from "./production/machine-status-log.model.js";
export * from "./production/monitoring-snapshot.model.js";
export * from "./production/stock-movement.model.js";
export * from "./production/reservation.model.js";
export * from "./production/alert.model.js";

// Group 6: Client Interaction
export * from "./interaction/client-interaction.model.js";
export * from "./interaction/conversation.model.js";
export * from "./interaction/message.model.js";
export * from "./interaction/escalation.model.js";
export * from "./interaction/agent-run.model.js";

// Group 7: Platform
export * from "./platform/notification.model.js";
export * from "./platform/outbox-message.model.js";
export * from "./platform/audit-log.model.js";
export * from "./platform/refresh-token.model.js";
export * from "./platform/idempotency-key.model.js";
export * from "./platform/counter.model.js";
export * from "./platform/import-job.model.js";
export * from "./platform/file.model.js";
