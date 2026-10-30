import { describe, it, expect, beforeAll } from "vitest";
import {
  UserModel,
  ClientModel,
  OrderModel,
  PriceObservationModel,
  PriceHistoryModel,
  MessageModel,
  NotificationModel,
  SupervisorDailyReportModel,
  IdempotencyKeyModel,
  DailyOutputModel,
  MachineStatusLogModel,
  ReservationModel,
  ConversationModel,
  QuotationCostingModel,
} from "../../src/models/index.js";

describe("Stage 2: Schema v3 Indexes & Constraints", () => {
  beforeAll(async () => {
    // Ensure all indexes are built in MongoDB
    await Promise.all([
      UserModel.init(),
      ClientModel.init(),
      OrderModel.init(),
      PriceObservationModel.init(),
      PriceHistoryModel.init(),
      MessageModel.init(),
      NotificationModel.init(),
      SupervisorDailyReportModel.init(),
      IdempotencyKeyModel.init(),
      DailyOutputModel.init(),
      MachineStatusLogModel.init(),
      ReservationModel.init(),
      ConversationModel.init(),
      QuotationCostingModel.init(),
    ]);
  }, 30000);

  it("verifies Order key indexes (status, deliveryDeadline), (clientId), (orderNumber)", async () => {
    const indexes = await OrderModel.collection.indexes();
    const indexNames = indexes.map((idx) => idx.name);

    // orderNumber unique
    expect(indexNames).toContain("tenantId_1_orderNumber_1");
    const orderNumberIdx = indexes.find((i) => i.name === "tenantId_1_orderNumber_1");
    expect(orderNumberIdx?.unique).toBe(true);

    // (status, deliveryDeadline)
    expect(indexNames).toContain("tenantId_1_status_1_deliveryDeadline_1");

    // (clientId)
    expect(indexNames).toContain("tenantId_1_clientId_1");
  });

  it("verifies PriceObservation key index (material, observationDate, source) unique", async () => {
    const indexes = await PriceObservationModel.collection.indexes();
    const obsIdx = indexes.find(
      (i) => i.name === "tenantId_1_materialId_1_observationDate_1_sourceId_1"
    );
    expect(obsIdx).toBeDefined();
    expect(obsIdx?.unique).toBe(true);
  });

  it("verifies PriceHistory key index (material, date) unique", async () => {
    const indexes = await PriceHistoryModel.collection.indexes();
    const historyIdx = indexes.find((i) => i.name === "tenantId_1_materialId_1_date_1");
    expect(historyIdx).toBeDefined();
    expect(historyIdx?.unique).toBe(true);
  });

  it("verifies Message key index (conversationId, createdAt)", async () => {
    const indexes = await MessageModel.collection.indexes();
    const indexNames = indexes.map((idx) => idx.name);
    expect(indexNames).toContain("tenantId_1_conversationId_1_createdAt_1");
  });

  it("verifies Notification key index (userId, readAt)", async () => {
    const indexes = await NotificationModel.collection.indexes();
    const indexNames = indexes.map((idx) => idx.name);
    expect(indexNames).toContain("tenantId_1_userId_1_readAt_1");
  });

  it("verifies SupervisorDailyReport unique constraint (supervisorId, reportDate)", async () => {
    const indexes = await SupervisorDailyReportModel.collection.indexes();
    const supIdx = indexes.find((i) => i.name === "tenantId_1_supervisorId_1_reportDate_1");
    expect(supIdx).toBeDefined();
    expect(supIdx?.unique).toBe(true);
  });

  it("verifies DailyOutput unique constraint (order, stage, date, supervisor)", async () => {
    const indexes = await DailyOutputModel.collection.indexes();
    const outputIdx = indexes.find(
      (i) => i.name === "tenantId_1_orderId_1_processStage_1_outputDate_1_supervisorId_1"
    );
    expect(outputIdx).toBeDefined();
    expect(outputIdx?.unique).toBe(true);
  });

  it("verifies MachineStatusLog unique constraint (machineId, statusDate)", async () => {
    const indexes = await MachineStatusLogModel.collection.indexes();
    const machineIdx = indexes.find((i) => i.name === "tenantId_1_machineId_1_statusDate_1");
    expect(machineIdx).toBeDefined();
    expect(machineIdx?.unique).toBe(true);
  });

  it("verifies Reservation unique constraint (orderId, materialId)", async () => {
    const indexes = await ReservationModel.collection.indexes();
    const resIdx = indexes.find((i) => i.name === "tenantId_1_orderId_1_materialId_1");
    expect(resIdx).toBeDefined();
    expect(resIdx?.unique).toBe(true);
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

  it("verifies QuotationCosting unique index (quotationId) for admin-only isolation", async () => {
    const indexes = await QuotationCostingModel.collection.indexes();
    const costingIdx = indexes.find((i) => i.name === "tenantId_1_quotationId_1");
    expect(costingIdx).toBeDefined();
    expect(costingIdx?.unique).toBe(true);
  });
});
