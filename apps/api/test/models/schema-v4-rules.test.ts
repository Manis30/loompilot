import { describe, it, expect } from "vitest";
import mongoose, { Schema } from "mongoose";
import * as Models from "../../src/models/index.js";
import {
  NotificationModel,
  OutboxMessageModel,
  SupervisorDailyReportModel,
  OrderModel,
  ClientModel,
  MarketPriceModel,
  ConversationModel,
  validateUserProcessAreas,
} from "../../src/models/index.js";
import { SCHEMA_V4_MANIFEST } from "@loompilot/shared";

describe("Stage 3.5: Step 2 Schema v4 Architectural Rules & Invariants", () => {
  // -------------------------------------------------------------------------
  // 1. Model Set == Manifest (mongoose.modelNames() & collection.name)
  // -------------------------------------------------------------------------
  it("proves model-set == manifest (compares mongoose.modelNames() and collection.name, failing on extras)", () => {
    const expectedModelNames = Object.values(SCHEMA_V4_MANIFEST)
      .map((m) => m.modelName)
      .sort();
    const actualModelNames = mongoose.modelNames().sort();

    // 1. Exactly the 22 models are registered, fail on any extra models
    expect(actualModelNames.length).toBe(22);
    expect(expectedModelNames.length).toBe(22);
    expect(actualModelNames).toEqual(expectedModelNames);

    // 2. Verify each model matches its manifest definition and collection.name
    for (const [key, manifest] of Object.entries(SCHEMA_V4_MANIFEST)) {
      const model = (Models as any)[key] || mongoose.model(manifest.modelName);
      expect(model).toBeDefined();
      expect(typeof model).toBe("function");
      expect(model.modelName).toBe(manifest.modelName);
      expect(model.collection.name).toBe(manifest.collectionName);
    }
  });

  // -------------------------------------------------------------------------
  // 2. Nested Mongoose Schemas (_id: false, strict: true, not loose Mixed)
  // -------------------------------------------------------------------------
  it("proves embedded objects use strict nested schemas with _id:false (never loose Mixed)", () => {
    // OrderModel embedded paths
    const orderSchema = OrderModel.schema;
    const specPath: any = orderSchema.path("spec");
    expect(specPath.schema).toBeDefined();
    expect(specPath.schema.options._id).toBe(false);
    expect(specPath.schema.options.strict).toBe(true);

    const feasPath: any = orderSchema.path("feasibility");
    expect(feasPath.schema).toBeDefined();
    expect(feasPath.schema.options._id).toBe(false);

    const quotePath: any = orderSchema.path("quotation");
    expect(quotePath.schema).toBeDefined();
    expect(quotePath.schema.options._id).toBe(false);

    // ClientModel portalAccess
    const clientSchema = ClientModel.schema;
    const portalPath: any = clientSchema.path("portalAccess");
    expect(portalPath.schema).toBeDefined();
    expect(portalPath.schema.options._id).toBe(false);

    // SupervisorDailyReportModel outputs, machines, workforce
    const reportSchema = SupervisorDailyReportModel.schema;
    const workforcePath: any = reportSchema.path("workforce");
    expect(workforcePath.schema).toBeDefined();
    expect(workforcePath.schema.options._id).toBe(false);

    const outputsPath: any = reportSchema.path("outputs");
    expect(outputsPath.schema).toBeDefined();
    expect(outputsPath.schema.options._id).toBe(false);

    // ConversationModel messages, escalation
    const convSchema = ConversationModel.schema;
    const messagesPath: any = convSchema.path("messages");
    expect(messagesPath.schema).toBeDefined();
    expect(messagesPath.schema.options._id).toBe(false);

    const escPath: any = convSchema.path("escalation");
    expect(escPath.schema).toBeDefined();
    expect(escPath.schema.options._id).toBe(false);

    // MarketPriceModel observations, alert
    const priceSchema = MarketPriceModel.schema;
    const obsPath: any = priceSchema.path("observations");
    expect(obsPath.schema).toBeDefined();
    expect(obsPath.schema.options._id).toBe(false);

    const alertPath: any = priceSchema.path("alert");
    expect(alertPath.schema).toBeDefined();
    expect(alertPath.schema.options._id).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 3. Notification Recipient XOR
  // -------------------------------------------------------------------------
  describe("Notification Recipient XOR", () => {
    it("allows notification with only userId", () => {
      const notif = new NotificationModel({
        tenantId: "tenant_t1",
        recipient: { userId: new mongoose.Types.ObjectId() },
        title: "Test",
        body: "Test Body",
        type: "order_alert",
        channel: "in_app",
      });
      const err = notif.validateSync();
      expect(err).toBeUndefined();
    });

    it("allows notification with only clientId", () => {
      const notif = new NotificationModel({
        tenantId: "tenant_t1",
        recipient: { clientId: new mongoose.Types.ObjectId() },
        title: "Test",
        body: "Test Body",
        type: "order_alert",
        channel: "in_app",
      });
      const err = notif.validateSync();
      expect(err).toBeUndefined();
    });

    it("rejects notification when both userId and clientId are specified", () => {
      const notif = new NotificationModel({
        tenantId: "tenant_t1",
        recipient: {
          userId: new mongoose.Types.ObjectId(),
          clientId: new mongoose.Types.ObjectId(),
        },
        title: "Test",
        body: "Test Body",
        type: "order_alert",
        channel: "in_app",
      });
      const err = notif.validateSync();
      expect(err).toBeDefined();
      expect(err?.message).toMatch(/exactly one recipient: userId OR clientId \(XOR\)/);
    });

    it("rejects notification when neither userId nor clientId is specified", () => {
      const notif = new NotificationModel({
        tenantId: "tenant_t1",
        recipient: {},
        title: "Test",
        body: "Test Body",
        type: "order_alert",
        channel: "in_app",
      });
      const err = notif.validateSync();
      expect(err).toBeDefined();
      expect(err?.message).toMatch(/exactly one recipient: userId OR clientId \(XOR\)/);
    });
  });

  // -------------------------------------------------------------------------
  // 4. OutboxMessage Recipient XOR
  // -------------------------------------------------------------------------
  describe("OutboxMessage Recipient XOR", () => {
    it("allows outbox message with only userId", () => {
      const msg = new OutboxMessageModel({
        tenantId: "tenant_t1",
        recipient: { userId: new mongoose.Types.ObjectId() },
        channel: "email",
        payload: { to: "user@example.com", body: "Hello" },
      });
      const err = msg.validateSync();
      expect(err).toBeUndefined();
    });

    it("allows outbox message with only clientId", () => {
      const msg = new OutboxMessageModel({
        tenantId: "tenant_t1",
        recipient: { clientId: new mongoose.Types.ObjectId() },
        channel: "email",
        payload: { to: "client@example.com", body: "Hello" },
      });
      const err = msg.validateSync();
      expect(err).toBeUndefined();
    });

    it("rejects outbox message when both userId and clientId are specified", () => {
      const msg = new OutboxMessageModel({
        tenantId: "tenant_t1",
        recipient: {
          userId: new mongoose.Types.ObjectId(),
          clientId: new mongoose.Types.ObjectId(),
        },
        channel: "email",
        payload: { to: "conflict@example.com" },
      });
      const err = msg.validateSync();
      expect(err).toBeDefined();
      expect(err?.message).toMatch(/exactly one recipient: userId OR clientId \(XOR\)/);
    });

    it("rejects outbox message when neither userId nor clientId is specified", () => {
      const msg = new OutboxMessageModel({
        tenantId: "tenant_t1",
        recipient: {},
        channel: "email",
        payload: { to: "empty@example.com" },
      });
      const err = msg.validateSync();
      expect(err).toBeDefined();
      expect(err?.message).toMatch(/exactly one recipient: userId OR clientId \(XOR\)/);
    });
  });

  // -------------------------------------------------------------------------
  // 5. SupervisorDailyReport: workforce sum == employeesPresentTotal
  // -------------------------------------------------------------------------
  describe("SupervisorDailyReport Workforce Sum Invariant", () => {
    it("passes validation when workforce sum matches employeesPresentTotal exactly", () => {
      const report = new SupervisorDailyReportModel({
        tenantId: "tenant_t1",
        reportDate: "2026-10-30",
        supervisorId: new mongoose.Types.ObjectId(),
        processAreas: ["weaving", "spinning"],
        employeesPresentTotal: 10,
        workforce: [
          { area: "weaving", count: 6 },
          { area: "spinning", count: 4 },
        ],
      });
      const err = report.validateSync();
      expect(err).toBeUndefined();
    });

    it("rejects report when workforce sum does not match employeesPresentTotal", () => {
      const report = new SupervisorDailyReportModel({
        tenantId: "tenant_t1",
        reportDate: "2026-10-30",
        supervisorId: new mongoose.Types.ObjectId(),
        processAreas: ["weaving", "spinning"],
        employeesPresentTotal: 10,
        workforce: [
          { area: "weaving", count: 5 },
          { area: "spinning", count: 3 }, // sum = 8 != 10
        ],
      });
      const err = report.validateSync();
      expect(err).toBeDefined();
      expect(err?.message).toMatch(
        /Workforce count sum must equal employeesPresentTotal/
      );
    });

    it("passes validation when workforce is not provided (optional)", () => {
      const report = new SupervisorDailyReportModel({
        tenantId: "tenant_t1",
        reportDate: "2026-10-30",
        supervisorId: new mongoose.Types.ObjectId(),
        processAreas: ["weaving"],
        employeesPresentTotal: 5,
      });
      const err = report.validateSync();
      expect(err).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // 7. Order productId vs productDescription Validation
  // -------------------------------------------------------------------------
  describe("Order productId vs productDescription Validation", () => {
    const baseOrder = {
      tenantId: "tenant_t1",
      orderNumber: "ORD-VAL-001",
      clientId: new mongoose.Types.ObjectId(),
      quantity: 1000,
      deliveryDeadline: "2026-12-31",
      spec: { sizes: ["M", "L"] },
    };

    it("passes validation when only productId is provided", () => {
      const order = new OrderModel({
        ...baseOrder,
        productId: new mongoose.Types.ObjectId(),
      });
      const err = order.validateSync();
      expect(err).toBeUndefined();
    });

    it("passes validation when only productDescription is provided", () => {
      const order = new OrderModel({
        ...baseOrder,
        productDescription: "Custom 100% Organic Combed Cotton Twill",
      });
      const err = order.validateSync();
      expect(err).toBeUndefined();
    });

    it("passes validation when both productId and productDescription are provided", () => {
      const order = new OrderModel({
        ...baseOrder,
        productId: new mongoose.Types.ObjectId(),
        productDescription: "Custom modification of catalog shirt fabric",
      });
      const err = order.validateSync();
      expect(err).toBeUndefined();
    });

    it("fails validation when neither productId nor productDescription is provided", () => {
      const order = new OrderModel({
        ...baseOrder,
      });
      const err = order.validateSync();
      expect(err).toBeDefined();
      expect(err?.errors["productId"]).toBeDefined();
      expect(err?.errors["productId"].message).toContain(
        "Either productId or productDescription must be provided"
      );
    });
  });
});
