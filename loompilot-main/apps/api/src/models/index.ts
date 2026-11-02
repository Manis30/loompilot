// ============================================================================
// LoomPilot MongoDB Schema v4 Model Registry (Exactly 22 Collections)
// ============================================================================

// 1. Identity & Config (3 Domain Collections)
export * from "./identity/settings.model.js";
export * from "./identity/user.model.js";
export * from "./identity/client.model.js";

// 2. Catalog & Market Prices (5 Domain Collections)
export * from "./identity/supplier.model.js";
export * from "./catalog/material.model.js";
export * from "./catalog/machine.model.js";
export * from "./catalog/product.model.js";
export * from "./catalog/market-price.model.js";

// 3. Orders & Production Floor (6 Domain Collections)
export * from "./orders/order.model.js";
export * from "./production/supervisor-daily-report.model.js";
export * from "./interaction/conversation.model.js";
export * from "./production/maintenance-ticket.model.js";
export * from "./production/stock-movement.model.js";
export * from "./interaction/agent-run.model.js";

// 4. Platform & Infrastructure (8 Collections)
export * from "./platform/refresh-token.model.js";
export * from "./platform/idempotency-key.model.js";
export * from "./platform/audit-log.model.js";
export * from "./platform/counter.model.js";
export * from "./platform/notification.model.js";
export * from "./platform/outbox-message.model.js";
export * from "./platform/import-job.model.js";
export * from "./platform/file.model.js";
