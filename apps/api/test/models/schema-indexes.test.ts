import { describe, it, expect, beforeAll } from "vitest";
import {
  UserModel,
  ClientModel,
  OrderModel,
  MachineModel,
  MaterialModel,
  ProductModel,
  MarketPriceModel,
  NotificationModel,
  SupervisorDailyReportModel,
  IdempotencyKeyModel,
  ConversationModel,
  MaintenanceTicketModel,
  StockMovementModel,
  AgentRunModel,
  RefreshTokenModel,
  OutboxMessageModel,
  CounterModel,
  ImportJobModel,
  FileRecordModel,
} from "../../src/models/index.js";

describe("Stage 3.5: Schema v4 Indexes & Constraints (All 22 Collections)", () => {
  beforeAll(async () => {
    // Ensure all indexes are built in MongoDB
    await Promise.all([
      UserModel.init(),
      ClientModel.init(),
      MachineModel.init(),
      MaterialModel.init(),
      ProductModel.init(),
      MarketPriceModel.init(),
      OrderModel.init(),
      SupervisorDailyReportModel.init(),
      ConversationModel.init(),
      MaintenanceTicketModel.init(),
      StockMovementModel.init(),
      AgentRunModel.init(),
      RefreshTokenModel.init(),
      IdempotencyKeyModel.init(),
      NotificationModel.init(),
      OutboxMessageModel.init(),
      CounterModel.init(),
      ImportJobModel.init(),
      FileRecordModel.init(),
    ]);
  }, 30000);

  it("verifies UserModel unique index (email)", async () => {
    const indexes = await UserModel.collection.indexes();
    const emailIdx = indexes.find((i) => i.name === "tenantId_1_email_1");
    expect(emailIdx).toBeDefined();
    expect(emailIdx?.unique).toBe(true);
  });

  it("verifies MachineModel unique index (machineCode)", async () => {
    const indexes = await MachineModel.collection.indexes();
    const codeIdx = indexes.find((i) => i.name === "tenantId_1_machineCode_1");
    expect(codeIdx).toBeDefined();
    expect(codeIdx?.unique).toBe(true);
  });

  it("verifies Order key indexes and partial unique constraints", async () => {
    const indexes = await OrderModel.collection.indexes();
    const indexNames = indexes.map((idx) => idx.name);

    // orderNumber unique
    expect(indexNames).toContain("tenantId_1_orderNumber_1");
    const orderNumberIdx = indexes.find((i) => i.name === "tenantId_1_orderNumber_1");
    expect(orderNumberIdx?.unique).toBe(true);

    // (status, deliveryDeadline)
    expect(indexNames).toContain("tenantId_1_status_1_deliveryDeadline_1");

    // (clientId, createdAt)
    expect(indexNames).toContain("tenantId_1_clientId_1_createdAt_1");

    // Supervisor assignment compound
    expect(indexNames).toContain("tenantId_1_production.assignedSupervisors.supervisorId_1_status_1");

    // Financial milestone compound
    expect(indexNames).toContain("tenantId_1_financials.milestones.status_1_financials.milestones.dueDate_1");

    // Partial unique idempotencyKey
    const idempIdx = indexes.find((i) => i.name === "tenantId_1_idempotencyKey_1");
    expect(idempIdx?.unique).toBe(true);
    expect(idempIdx?.partialFilterExpression).toEqual({ idempotencyKey: { $type: "string" } });
  });

  it("verifies MarketPrice unique index (material, date)", async () => {
    const indexes = await MarketPriceModel.collection.indexes();
    const priceIdx = indexes.find((i) => i.name === "tenantId_1_materialId_1_date_1");
    expect(priceIdx).toBeDefined();
    expect(priceIdx?.unique).toBe(true);
  });

  it("verifies Conversation unique index (orderId)", async () => {
    const indexes = await ConversationModel.collection.indexes();
    const convIdx = indexes.find((i) => i.name === "tenantId_1_orderId_1");
    expect(convIdx).toBeDefined();
    expect(convIdx?.unique).toBe(true);
  });

  it("verifies Notification inbox indexes and dedupeKey partial index", async () => {
    const indexes = await NotificationModel.collection.indexes();
    const indexNames = indexes.map((idx) => idx.name);

    expect(indexNames).toContain("tenantId_1_recipient.userId_1_createdAt_-1");
    expect(indexNames).toContain("tenantId_1_recipient.clientId_1_createdAt_-1");
    expect(indexNames).toContain("tenantId_1_status_1");

    const dedupeIdx = indexes.find((i) => i.name === "tenantId_1_dedupeKey_1");
    expect(dedupeIdx?.unique).toBe(true);
    expect(dedupeIdx?.partialFilterExpression).toEqual({ dedupeKey: { $type: "string" } });
  });

  it("verifies SupervisorDailyReport unique constraint (supervisorId, reportDate)", async () => {
    const indexes = await SupervisorDailyReportModel.collection.indexes();
    const supIdx = indexes.find((i) => i.name === "tenantId_1_supervisorId_1_reportDate_1");
    expect(supIdx).toBeDefined();
    expect(supIdx?.unique).toBe(true);
  });

  it("verifies MaintenanceTicket compound index (machineId, status)", async () => {
    const indexes = await MaintenanceTicketModel.collection.indexes();
    const ticketIdx = indexes.find((i) => i.name === "tenantId_1_machineId_1_status_1");
    expect(ticketIdx).toBeDefined();
  });

  it("verifies StockMovement compound index (materialId, createdAt)", async () => {
    const indexes = await StockMovementModel.collection.indexes();
    const smIdx = indexes.find((i) => i.name === "tenantId_1_materialId_1_createdAt_1");
    expect(smIdx).toBeDefined();
  });

  it("verifies IdempotencyKey unique (key, route) and TTL index on expiresAt", async () => {
    const indexes = await IdempotencyKeyModel.collection.indexes();
    const keyIdx = indexes.find((i) => i.name === "tenantId_1_key_1_route_1");
    expect(keyIdx).toBeDefined();
    expect(keyIdx?.unique).toBe(true);

    const ttlIdx = indexes.find((i) => i.name === "expiresAt_1");
    expect(ttlIdx).toBeDefined();
    expect(ttlIdx?.expireAfterSeconds).toBe(0);
  });

  it("verifies RefreshToken unique (tokenHash) and TTL index on expiresAt", async () => {
    const indexes = await RefreshTokenModel.collection.indexes();
    const tokenIdx = indexes.find((i) => i.name === "tokenHash_1");
    expect(tokenIdx).toBeDefined();
    expect(tokenIdx?.unique).toBe(true);

    const ttlIdx = indexes.find((i) => i.name === "expiresAt_1");
    expect(ttlIdx).toBeDefined();
    expect(ttlIdx?.expireAfterSeconds).toBe(0);
  });
});
