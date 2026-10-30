import { describe, it, expect, beforeAll } from "vitest";
import mongoose, { Schema } from "mongoose";
import { SCHEMA_V4_MANIFEST, OrderStatus } from "@loompilot/shared";
import {
  ClientModel,
  OrderModel,
  SupervisorDailyReportModel,
  NotificationModel,
} from "../../src/models/index.js";

describe("Stage 3.5: Partial Unique Indexes & Real Models Verification", () => {
  beforeAll(async () => {
    // Sync indexes for all 4 real models in test MongoDB
    await ClientModel.syncIndexes();
    await OrderModel.syncIndexes();
    await SupervisorDailyReportModel.syncIndexes();
    await NotificationModel.syncIndexes();
  });

  // -------------------------------------------------------------------------
  // 1. Manifest Index Definitions
  // -------------------------------------------------------------------------
  it("verifies manifest definitions specify partialFilterExpression for all partial unique replacements", () => {
    // 1. clients.portalAccess.email
    const clientIndexes = SCHEMA_V4_MANIFEST.ClientModel.indexes;
    const portalEmailIdx = clientIndexes.find(
      (idx) => idx.fields["portalAccess.email"] === 1 && idx.fields.tenantId === 1
    );
    expect(portalEmailIdx).toBeDefined();
    expect(portalEmailIdx?.unique).toBe(true);
    expect(portalEmailIdx?.sparse).toBeUndefined();
    expect(portalEmailIdx?.partialFilterExpression).toEqual({
      "portalAccess.email": { $type: "string" },
    });

    // 2. orders.idempotencyKey
    const orderIndexes = SCHEMA_V4_MANIFEST.OrderModel.indexes;
    const idempotencyIdx = orderIndexes.find(
      (idx) => idx.fields.idempotencyKey === 1 && idx.fields.tenantId === 1
    );
    expect(idempotencyIdx).toBeDefined();
    expect(idempotencyIdx?.unique).toBe(true);
    expect(idempotencyIdx?.sparse).toBeUndefined();
    expect(idempotencyIdx?.partialFilterExpression).toEqual({
      idempotencyKey: { $type: "string" },
    });

    // 3. supervisorDailyReports.clientGeneratedId
    const reportIndexes = SCHEMA_V4_MANIFEST.SupervisorDailyReportModel.indexes;
    const clientGenIdx = reportIndexes.find(
      (idx) => idx.fields.clientGeneratedId === 1 && idx.fields.tenantId === 1
    );
    expect(clientGenIdx).toBeDefined();
    expect(clientGenIdx?.unique).toBe(true);
    expect(clientGenIdx?.sparse).toBeUndefined();
    expect(clientGenIdx?.partialFilterExpression).toEqual({
      clientGeneratedId: { $type: "string" },
    });

    // 4. notifications.dedupeKey (strictly partial unique, not sparse)
    const notifIndexes = SCHEMA_V4_MANIFEST.NotificationModel.indexes;
    const dedupeIdx = notifIndexes.find(
      (idx) => idx.fields.dedupeKey === 1 && idx.fields.tenantId === 1
    );
    expect(dedupeIdx).toBeDefined();
    expect(dedupeIdx?.unique).toBe(true);
    expect(dedupeIdx?.sparse).toBeUndefined();
    expect(dedupeIdx?.partialFilterExpression).toEqual({
      dedupeKey: { $type: "string" },
    });

    // 5. orders Razorpay index: non-unique index on (tenantId, receipts.razorpayPaymentId)
    const rzpIdx = orderIndexes.find(
      (idx) =>
        idx.fields["financials.milestones.receipts.razorpayPaymentId"] === 1 &&
        idx.fields.tenantId === 1
    );
    expect(rzpIdx).toBeDefined();
    expect(rzpIdx?.unique).toBeUndefined();
    expect(rzpIdx?.partialFilterExpression).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // 2. Real ClientModel: portalAccess.email partial unique index
  // -------------------------------------------------------------------------
  it("proves in real ClientModel: two clients without portalAccess.email both insert", async () => {
    const tenantId = `tenant_client_partial_${Date.now()}`;

    // Two clients without portalAccess.email both insert
    const c1 = await ClientModel.create({
      tenantId,
      clientName: "Client A Without Portal Email",
      status: "active",
    });
    const c2 = await ClientModel.create({
      tenantId,
      clientName: "Client B Without Portal Email",
      status: "active",
    });
    expect(c1._id).toBeDefined();
    expect(c2._id).toBeDefined();

    // Two clients with different portal emails insert
    const c3 = await ClientModel.create({
      tenantId,
      clientName: "Client C",
      portalAccess: { email: "user1@clientc.local", status: "active" },
    });
    expect(c3.portalAccess?.email).toBe("user1@clientc.local");

    // Duplicate email in same tenant throws E11000
    await expect(
      ClientModel.create({
        tenantId,
        clientName: "Client D Duplicate",
        portalAccess: { email: "user1@clientc.local", status: "active" },
      })
    ).rejects.toThrow(/E11000/);
  });

  // -------------------------------------------------------------------------
  // 3. Real OrderModel: idempotencyKey partial unique index
  // -------------------------------------------------------------------------
  it("proves in real OrderModel: two orders without idempotencyKey both insert", async () => {
    const tenantId = `tenant_order_partial_${Date.now()}`;
    const clientId = new mongoose.Types.ObjectId();

    // Two orders without idempotencyKey both insert
    const o1 = await OrderModel.create({
      tenantId,
      orderNumber: "ORD-NO-IDEMP-1",
      clientId,
      quantity: 100,
      deliveryDeadline: "2026-12-31",
      productDescription: "Custom Combed Cotton",
      spec: { sizes: ["S", "M"] },
    });
    const o2 = await OrderModel.create({
      tenantId,
      orderNumber: "ORD-NO-IDEMP-2",
      clientId,
      quantity: 200,
      deliveryDeadline: "2026-12-31",
      productDescription: "Custom Linen Weave",
      spec: { sizes: ["L"] },
    });
    expect(o1._id).toBeDefined();
    expect(o2._id).toBeDefined();

    // With idempotencyKey
    await OrderModel.create({
      tenantId,
      orderNumber: "ORD-WITH-IDEMP-1",
      clientId,
      quantity: 300,
      deliveryDeadline: "2026-12-31",
      productDescription: "Fabric",
      spec: { sizes: ["XL"] },
      idempotencyKey: "idemp_test_key_1",
    });

    // Duplicate idempotencyKey in same tenant throws E11000
    await expect(
      OrderModel.create({
        tenantId,
        orderNumber: "ORD-WITH-IDEMP-2",
        clientId,
        quantity: 400,
        deliveryDeadline: "2026-12-31",
        productDescription: "Fabric",
        spec: { sizes: ["XL"] },
        idempotencyKey: "idemp_test_key_1",
      })
    ).rejects.toThrow(/E11000/);
  });

  // -------------------------------------------------------------------------
  // 4. Real SupervisorDailyReportModel: clientGeneratedId partial unique index
  // -------------------------------------------------------------------------
  it("proves in real SupervisorDailyReportModel: two reports without clientGeneratedId both insert", async () => {
    const tenantId = `tenant_report_partial_${Date.now()}`;
    const sup1 = new mongoose.Types.ObjectId();
    const sup2 = new mongoose.Types.ObjectId();

    // Two reports without clientGeneratedId both insert
    const r1 = await SupervisorDailyReportModel.create({
      tenantId,
      reportDate: "2026-11-01",
      supervisorId: sup1,
      processAreas: ["weaving"],
      employeesPresentTotal: 10,
    });
    const r2 = await SupervisorDailyReportModel.create({
      tenantId,
      reportDate: "2026-11-01",
      supervisorId: sup2,
      processAreas: ["spinning"],
      employeesPresentTotal: 12,
    });
    expect(r1._id).toBeDefined();
    expect(r2._id).toBeDefined();

    // With clientGeneratedId
    await SupervisorDailyReportModel.create({
      tenantId,
      reportDate: "2026-11-02",
      supervisorId: sup1,
      processAreas: ["weaving"],
      employeesPresentTotal: 8,
      clientGeneratedId: "client_offline_uuid_001",
    });

    // Duplicate clientGeneratedId in same tenant throws E11000
    await expect(
      SupervisorDailyReportModel.create({
        tenantId,
        reportDate: "2026-11-02",
        supervisorId: sup2,
        processAreas: ["spinning"],
        employeesPresentTotal: 9,
        clientGeneratedId: "client_offline_uuid_001",
      })
    ).rejects.toThrow(/E11000/);
  });

  // -------------------------------------------------------------------------
  // 5. Real NotificationModel: dedupeKey partial unique index
  // -------------------------------------------------------------------------
  it("proves in real NotificationModel: two notifications without dedupeKey both insert", async () => {
    const tenantId = `tenant_notif_partial_${Date.now()}`;
    const userId = new mongoose.Types.ObjectId();

    // Two notifications without dedupeKey both insert
    const n1 = await NotificationModel.create({
      tenantId,
      recipient: { userId },
      channel: "in_app",
      title: "Notice 1",
      body: "Body 1",
      type: "order_alert",
    });
    const n2 = await NotificationModel.create({
      tenantId,
      recipient: { userId },
      channel: "in_app",
      title: "Notice 2",
      body: "Body 2",
      type: "order_alert",
    });
    expect(n1._id).toBeDefined();
    expect(n2._id).toBeDefined();

    // With dedupeKey
    await NotificationModel.create({
      tenantId,
      recipient: { userId },
      channel: "in_app",
      title: "Stock Alert",
      body: "Yarn Low",
      type: "stock_alert",
      dedupeKey: "stock_alert_yarn_001",
    });

    // Duplicate dedupeKey in same tenant throws E11000
    await expect(
      NotificationModel.create({
        tenantId,
        recipient: { userId },
        channel: "in_app",
        title: "Stock Alert",
        body: "Yarn Low Again",
        type: "stock_alert",
        dedupeKey: "stock_alert_yarn_001",
      })
    ).rejects.toThrow(/E11000/);
  });

  // -------------------------------------------------------------------------
  // 6. Item D Proof & Replacement of Razorpay Nested Array Index
  // -------------------------------------------------------------------------
  it("proves a unique partial index on multikey array receipts throws E11000 on mixed receipts, justifying non-unique index", async () => {
    // Demonstration schema with unique partial index on array receipts
    const DemoReceiptSchema = new Schema(
      {
        method: { type: String, required: true },
        razorpayPaymentId: { type: String },
      },
      { _id: false }
    );

    const DemoMilestoneSchema = new Schema(
      {
        name: { type: String, required: true },
        receipts: [DemoReceiptSchema],
      },
      { _id: false }
    );

    const DemoOrderSchema = new Schema(
      {
        tenantId: { type: String, required: true },
        orderNumber: { type: String, required: true },
        financials: { milestones: [DemoMilestoneSchema] },
      },
      { timestamps: true }
    );

    DemoOrderSchema.index(
      { tenantId: 1, "financials.milestones.receipts.razorpayPaymentId": 1 },
      {
        unique: true,
        partialFilterExpression: {
          "financials.milestones.receipts.razorpayPaymentId": { $type: "string" },
        },
      }
    );

    const DemoModel =
      mongoose.models.DemoRzpOrder || mongoose.model("DemoRzpOrder", DemoOrderSchema);
    await DemoModel.init();

    const tenantId = `tenant_rzp_proof_${Date.now()}`;

    // Order 1 has one razorpay receipt and one neft receipt (no razorpayPaymentId)
    await DemoModel.create({
      tenantId,
      orderNumber: "DEMO-ORD-1",
      financials: {
        milestones: [
          {
            name: "Advance",
            receipts: [
              { method: "razorpay", razorpayPaymentId: "pay_distinct_001" },
              { method: "neft" },
            ],
          },
        ],
      },
    });

    // Order 2 has a DIFFERENT razorpay receipt, but ALSO an neft receipt (no razorpayPaymentId).
    // In MongoDB multikey indexing, both documents evaluate to null for the neft receipt key,
    // so MongoDB unique index throws E11000 duplicate key error!
    await expect(
      DemoModel.create({
        tenantId,
        orderNumber: "DEMO-ORD-2",
        financials: {
          milestones: [
            {
              name: "Advance",
              receipts: [
                { method: "razorpay", razorpayPaymentId: "pay_distinct_002" },
                { method: "neft" },
              ],
            },
          ],
        },
      })
    ).rejects.toThrow(/E11000/);

    // Clean up demo model from mongoose.models to keep model-set pristine
    delete mongoose.models.DemoRzpOrder;
    delete (mongoose as any).modelSchemas?.DemoRzpOrder;

    // NOW PROVE REAL OrderModel: With non-unique index, both orders insert cleanly!
    const realTenant = `tenant_real_rzp_${Date.now()}`;
    const clientId = new mongoose.Types.ObjectId();

    const order1 = await OrderModel.create({
      tenantId: realTenant,
      orderNumber: "REAL-ORD-1",
      clientId,
      quantity: 500,
      deliveryDeadline: "2026-12-31",
      productDescription: "Fabric 1",
      spec: { sizes: ["M"] },
      financials: {
        milestones: [
          {
            milestone: "Advance",
            trigger: "advance",
            amountPaise: 50000,
            status: "partial",
            receipts: [
              { amountPaise: 30000, method: "razorpay", ref: "RZP-1", date: "2026-11-01", razorpayPaymentId: "pay_real_001" },
              { amountPaise: 20000, method: "neft", ref: "NEFT-1", date: "2026-11-02" },
            ],
          },
        ],
      },
    });

    const order2 = await OrderModel.create({
      tenantId: realTenant,
      orderNumber: "REAL-ORD-2",
      clientId,
      quantity: 500,
      deliveryDeadline: "2026-12-31",
      productDescription: "Fabric 2",
      spec: { sizes: ["L"] },
      financials: {
        milestones: [
          {
            milestone: "Advance",
            trigger: "advance",
            amountPaise: 50000,
            status: "partial",
            receipts: [
              { amountPaise: 30000, method: "razorpay", ref: "RZP-2", date: "2026-11-01", razorpayPaymentId: "pay_real_002" },
              { amountPaise: 20000, method: "neft", ref: "NEFT-2", date: "2026-11-02" },
            ],
          },
        ],
      },
    });

    expect(order1._id).toBeDefined();
    expect(order2._id).toBeDefined();
  });
});
