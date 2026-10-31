import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { Types } from "mongoose";
import crypto from "node:crypto";
import { createApp } from "../../src/app.js";
import {
  OrderModel,
  MaterialModel,
  UserModel,
  ClientModel,
  NotificationModel,
  StockMovementModel,
  SettingsModel,
} from "../../src/models/index.js";
import {
  createTestUser,
  createTestClientAccount,
  generateTestAuthHeader,
  ensureDefaultSettings,
} from "../helpers/auth-helper.js";
import { getEnv } from "../../src/config/env.js";

function makeKey(): string {
  return `key_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

describe("Phase B/C/D Integrated Workflows Test Suite", () => {
  let app: any;
  const tenantId = `tenant_workflows_${Date.now()}`;
  let adminToken: string;
  let supervisor1Token: string;
  let supervisor2Token: string;
  let supervisor1Id: string;
  let supervisor2Id: string;
  let clientToken: string;
  let clientId: string;

  beforeAll(async () => {
    app = createApp();
    await ensureDefaultSettings(tenantId);

    // 1. Admin
    const { user: adminUser } = await createTestUser({ tenantId, role: "admin" });
    adminToken = generateTestAuthHeader({
      subjectId: String(adminUser._id),
      realm: "user",
      tenantId,
      role: "admin",
    });

    // 2. Supervisor 1 (knitting)
    const { user: s1User } = await createTestUser({
      tenantId,
      role: "supervisor",
      processAreas: ["knitting"],
    });
    supervisor1Id = String(s1User._id);
    supervisor1Token = generateTestAuthHeader({
      subjectId: supervisor1Id,
      realm: "user",
      tenantId,
      role: "supervisor",
      processAreas: ["knitting"],
    });

    // 3. Supervisor 2 (cutting)
    const { user: s2User } = await createTestUser({
      tenantId,
      role: "supervisor",
      processAreas: ["cutting"],
    });
    supervisor2Id = String(s2User._id);
    supervisor2Token = generateTestAuthHeader({
      subjectId: supervisor2Id,
      realm: "user",
      tenantId,
      role: "supervisor",
      processAreas: ["cutting"],
    });

    // 4. Client
    const { account } = await createTestClientAccount({ tenantId });
    clientId = String(account._id);
    clientToken = generateTestAuthHeader({
      subjectId: clientId,
      realm: "client",
      tenantId,
      clientId,
    });
  });

  afterAll(async () => {
    await OrderModel.deleteMany({ tenantId });
    await MaterialModel.deleteMany({ tenantId });
    await UserModel.deleteMany({ tenantId });
    await ClientModel.deleteMany({ tenantId });
    await NotificationModel.deleteMany({ tenantId });
    await StockMovementModel.deleteMany({ tenantId });
    await SettingsModel.deleteMany({ tenantId });
  });

  // =========================================================================
  // 1. Quotation Revision Decision Semantics
  // =========================================================================
  describe("Quotation Revision Decision Semantics (Requirement 6)", () => {
    it("accepts a revision, updates quotation pricing/milestones and transitions status", async () => {
      const order = await OrderModel.create({
        tenantId,
        orderNumber: `ORD-REV-ACC-${Date.now()}`,
        clientId: new Types.ObjectId(clientId),
        productDescription: "Custom Polo T-Shirts",
        quantity: 500,
        deliveryDeadline: "2026-12-01",
        spec: { sizes: ["M", "L"] },
        status: "quotation_sent",
        quotation: {
          unitPricePaise: 40000,
          totalPaise: 20000000,
          etaDate: "2026-12-01",
          status: "sent",
          paymentSchedule: [
            { milestone: "Advance", percent: 40, amountPaise: 8000000, trigger: "advance" },
            { milestone: "Delivery", percent: 60, amountPaise: 12000000, trigger: "stage", stage: "packing" },
          ],
          revisions: [
            {
              revisionNo: 1,
              reasonType: "price_surge",
              oldPricePaise: 20000000,
              newPricePaise: 22000000,
              changePct: 10,
              newEtaDate: "2026-12-05",
              clientReason: "Yarn price increase",
              status: "sent",
            },
          ],
        },
        version: 1,
      });

      const res = await request(app)
        .post(`/api/v1/client/orders/${order._id}/quotation/accept`)
        .set("Authorization", clientToken)
        .set("Idempotency-Key", makeKey())
        .send({ revisionNo: 1 });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("confirmed");

      // Verify DB update
      const updated = await OrderModel.findById(order._id).lean();
      expect(updated?.quotation?.totalPaise).toBe(22000000);
      expect(updated?.quotation?.unitPricePaise).toBe(44000); // 22000000 / 500
      expect(updated?.quotation?.revisions?.[0]?.status).toBe("accepted");
      expect(updated?.quotation?.paymentSchedule?.[0]?.amountPaise).toBe(8800000); // 40% of 22000000
    });

    it("declines a revision: original price stands, revision becomes 'declined', admin gets alert", async () => {
      const order = await OrderModel.create({
        tenantId,
        orderNumber: `ORD-REV-DEC-${Date.now()}`,
        clientId: new Types.ObjectId(clientId),
        productDescription: "Custom Roundneck T-Shirts",
        quantity: 1000,
        deliveryDeadline: "2026-12-10",
        spec: { sizes: ["L", "XL"] },
        status: "quotation_sent",
        quotation: {
          unitPricePaise: 30000,
          totalPaise: 30000000,
          etaDate: "2026-12-10",
          status: "sent",
          revisions: [
            {
              revisionNo: 1,
              reasonType: "price_surge",
              oldPricePaise: 30000000,
              newPricePaise: 35000000,
              changePct: 16.67,
              clientReason: "Cotton price surge",
              status: "sent",
            },
          ],
        },
        version: 1,
      });

      const res = await request(app)
        .post(`/api/v1/client/orders/${order._id}/quotation/decline`)
        .set("Authorization", clientToken)
        .set("Idempotency-Key", makeKey())
        .send({ revisionNo: 1, reason: "Too high for our budget" });

      expect(res.status).toBe(200);

      // Verify DB: original quotation price MUST STAND
      const updated = await OrderModel.findById(order._id).lean();
      expect(updated?.quotation?.totalPaise).toBe(30000000);
      expect(updated?.quotation?.unitPricePaise).toBe(30000);
      expect(updated?.quotation?.revisions?.[0]?.status).toBe("declined");
      expect(updated?.quotation?.revisions?.[0]?.clientDecision?.reason).toBe("Too high for our budget");

      // Verify admin alert notification was generated
      const alert = await NotificationModel.findOne({
        tenantId,
        kind: "alert",
        type: "quotation_revision_declined",
        "entity.id": String(order._id),
      }).lean();
      expect(alert).toBeDefined();
      expect(alert?.body).toContain("Original quotation price stands");
    });
  });

  // =========================================================================
  // 2. Advance Gate & Supervisor Assignment & Stock Reservation
  // =========================================================================
  describe("Advance Gate & Stock Reservation (POST /api/v1/orders/:id/assign)", () => {
    it("refuses supervisor assignment if required advance milestone is unpaid and no overrideReason", async () => {
      const order = await OrderModel.create({
        tenantId,
        orderNumber: `ORD-ADV-GATE-${Date.now()}`,
        clientId: new Types.ObjectId(clientId),
        productDescription: "Knitted Hoodies",
        quantity: 200,
        deliveryDeadline: "2026-12-15",
        spec: { sizes: ["M"] },
        status: "client_accepted",
        quotation: {
          totalPaise: 10000000,
          processPlan: [{ stage: "knitting", start: "2026-12-01", end: "2026-12-10", dailyTarget: 20 }],
        },
        financials: {
          totalPaidPaise: 0,
          advanceReceivedPaise: 0,
          milestones: [
            { milestone: "Advance", percent: 50, amountPaise: 5000000, trigger: "advance", status: "pending" },
          ],
        },
        version: 1,
      });

      const res = await request(app)
        .post(`/api/v1/orders/${order._id}/assign`)
        .set("Authorization", adminToken)
        .set("Idempotency-Key", makeKey())
        .send({
          assignments: [{ supervisorId: supervisor1Id, processArea: "knitting" }],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("ADVANCE_NOT_RECEIVED");
    });

    it("allows assignment with advance payment and atomically reserves stock", async () => {
      // 1. Create stock material
      const material = await MaterialModel.create({
        tenantId,
        materialName: "Fleece 280 GSM",
        type: "yarn",
        unit: "kg",
        stockQty: 500,
        reservedQty: 0,
        reorderLevel: 50,
        currentRatePaise: 35000,
        status: "active",
        version: 1,
      });

      // 2. Create order with material requirements and advance fully paid
      const order = await OrderModel.create({
        tenantId,
        orderNumber: `ORD-RES-STOCK-${Date.now()}`,
        clientId: new Types.ObjectId(clientId),
        productDescription: "Fleece Hoodies",
        quantity: 100,
        deliveryDeadline: "2026-12-20",
        spec: { sizes: ["L"] },
        status: "client_accepted",
        feasibility: {
          materialRequirements: [{ materialId: material._id, req: 150, avail: 150, short: 0 }],
        },
        quotation: {
          totalPaise: 8000000,
          processPlan: [
            { stage: "knitting", start: "2026-12-01", end: "2026-12-05", dailyTarget: 20 },
            { stage: "cutting", start: "2026-12-06", end: "2026-12-10", dailyTarget: 20 },
          ],
        },
        financials: {
          totalPaidPaise: 4000000,
          advanceReceivedPaise: 4000000,
          milestones: [
            { milestone: "Advance", percent: 50, amountPaise: 4000000, trigger: "advance", status: "received", receivedPaise: 4000000 },
          ],
        },
        version: 1,
      });

      const res = await request(app)
        .post(`/api/v1/orders/${order._id}/assign`)
        .set("Authorization", adminToken)
        .set("Idempotency-Key", makeKey())
        .send({
          assignments: [
            { supervisorId: supervisor1Id, processArea: "knitting" },
            { supervisorId: supervisor2Id, processArea: "cutting" },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("assigned");

      // Verify stock was reserved
      const updatedMaterial = await MaterialModel.findById(material._id).lean();
      expect(updatedMaterial?.reservedQty).toBe(150);

      // Verify order reservations
      const updatedOrder = await OrderModel.findById(order._id).lean();
      expect(updatedOrder?.reservations?.[0]?.status).toBe("active");
      expect(updatedOrder?.reservations?.[0]?.qty).toBe(150);
    });
  });

  // =========================================================================
  // 3. Two Supervisors Start Semantics & arrayFilters
  // =========================================================================
  describe("Start Semantics & Two Supervisors Acknowledgment (Requirement 4)", () => {
    it("transitions assigned -> in_production on first ack; second supervisor acknowledges via arrayFilters; returns only { id, status, assignmentStatus } to supervisors", async () => {
      const order = await OrderModel.create({
        tenantId,
        orderNumber: `ORD-START-TWO-${Date.now()}`,
        clientId: new Types.ObjectId(clientId),
        productDescription: "Crewneck Sweaters",
        quantity: 300,
        deliveryDeadline: "2026-12-25",
        spec: { sizes: ["M", "L"] },
        status: "assigned",
        quotation: { totalPaise: 15000000, unitPricePaise: 50000 },
        production: {
          assignmentStatus: "assigned",
          assignedSupervisors: [
            { supervisorId: new Types.ObjectId(supervisor1Id), processes: ["knitting"], acknowledgedAt: null },
            { supervisorId: new Types.ObjectId(supervisor2Id), processes: ["cutting"], acknowledgedAt: null },
          ],
        },
        version: 1,
      });

      // 1. First supervisor acknowledges
      const res1 = await request(app)
        .post(`/api/v1/orders/${order._id}/start`)
        .set("Authorization", supervisor1Token)
        .set("Idempotency-Key", makeKey())
        .send();

      expect(res1.status).toBe(200);
      expect(res1.body.data).toEqual({
        id: String(order._id),
        status: "in_production",
        assignmentStatus: "started",
      });

      // Verify DB: status moved to in_production and supervisor 1 acknowledgedAt is set
      let dbOrder = await OrderModel.findById(order._id).lean();
      expect(dbOrder?.status).toBe("in_production");
      const s1Entry = dbOrder?.production?.assignedSupervisors?.find((s) => String(s.supervisorId) === supervisor1Id);
      const s2Entry = dbOrder?.production?.assignedSupervisors?.find((s) => String(s.supervisorId) === supervisor2Id);
      expect(s1Entry?.acknowledgedAt).toBeDefined();
      expect(s2Entry?.acknowledgedAt).toBeNull();

      // 2. Second supervisor acknowledges while order is already in_production
      const res2 = await request(app)
        .post(`/api/v1/orders/${order._id}/start`)
        .set("Authorization", supervisor2Token)
        .set("Idempotency-Key", makeKey())
        .send();

      expect(res2.status).toBe(200);
      expect(res2.body.data).toEqual({
        id: String(order._id),
        status: "in_production",
        assignmentStatus: "started",
      });

      // Verify DB: second supervisor's acknowledgedAt is now set too via arrayFilters
      dbOrder = await OrderModel.findById(order._id).lean();
      const s2EntryAfter = dbOrder?.production?.assignedSupervisors?.find((s) => String(s.supervisorId) === supervisor2Id);
      expect(s2EntryAfter?.acknowledgedAt).toBeDefined();
    });
  });

  // =========================================================================
  // 4. Payments, Reversals, and Razorpay Webhook
  // =========================================================================
  describe("Payments, Reversal and Webhook Integration", () => {
    it("records manual payment receipt and handles payment reversal with required reason", async () => {
      const order = await OrderModel.create({
        tenantId,
        orderNumber: `ORD-PAY-${Date.now()}`,
        clientId: new Types.ObjectId(clientId),
        productDescription: "Cotton Pants",
        quantity: 100,
        deliveryDeadline: "2026-12-30",
        spec: { sizes: ["32"] },
        status: "in_production",
        quotation: { totalPaise: 5000000 },
        financials: {
          totalPaidPaise: 0,
          advanceReceivedPaise: 0,
          milestones: [
            { milestone: "Advance", percent: 50, amountPaise: 2500000, trigger: "advance", status: "pending", receivedPaise: 0, receipts: [] },
          ],
        },
        version: 1,
      });

      // 1. Record manual receipt
      const resPay = await request(app)
        .post(`/api/v1/orders/${order._id}/payments/manual-receipt`)
        .set("Authorization", adminToken)
        .set("Idempotency-Key", makeKey())
        .send({
          milestoneIndex: 0,
          amountPaise: 2500000,
          method: "neft",
          ref: "UTR12345678",
        });

      expect(resPay.status).toBe(200);
      let updated = await OrderModel.findById(order._id).lean();
      expect(updated?.financials?.milestones?.[0]?.status).toBe("received");
      expect(updated?.financials?.milestones?.[0]?.receivedPaise).toBe(2500000);

      // 2. Payment reversal: fails without reason
      const resRevFail = await request(app)
        .post(`/api/v1/orders/${order._id}/payments/reverse`)
        .set("Authorization", adminToken)
        .set("Idempotency-Key", makeKey())
        .send({
          milestoneIndex: 0,
          receiptIndex: 0,
          amountPaise: 2500000,
          reason: "   ",
        });

      expect(resRevFail.status).toBe(400);

      // 3. Payment reversal succeeds with valid reason
      const resRevPass = await request(app)
        .post(`/api/v1/orders/${order._id}/payments/reverse`)
        .set("Authorization", adminToken)
        .set("Idempotency-Key", makeKey())
        .send({
          milestoneIndex: 0,
          receiptIndex: 0,
          amountPaise: 2500000,
          reason: "NEFT bounced at bank",
        });

      expect(resRevPass.status).toBe(200);
      updated = await OrderModel.findById(order._id).lean();
      expect(updated?.financials?.milestones?.[0]?.status).toBe("pending");
      expect(updated?.financials?.milestones?.[0]?.receivedPaise).toBe(0);
    });

    it("verifies Razorpay webhook HMAC signature and idempotently marks milestone received", async () => {
      const env = getEnv();
      const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET || "rzp_webhook_secret_test";

      const order = await OrderModel.create({
        tenantId,
        orderNumber: `ORD-RZP-${Date.now()}`,
        clientId: new Types.ObjectId(clientId),
        productDescription: "Sublimation Jerseys",
        quantity: 50,
        deliveryDeadline: "2026-12-28",
        spec: { sizes: ["M"] },
        status: "in_production",
        quotation: { totalPaise: 1000000 },
        financials: {
          totalPaidPaise: 0,
          advanceReceivedPaise: 0,
          milestones: [
            {
              milestone: "Advance",
              percent: 100,
              amountPaise: 1000000,
              trigger: "advance",
              status: "pending",
              receivedPaise: 0,
              razorpayOrderId: "order_rzp_mock_123",
              receipts: [],
            },
          ],
        },
        version: 1,
      });

      const payload = {
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: `pay_mock_${Date.now()}`,
              order_id: "order_rzp_mock_123",
              amount: 1000000,
              currency: "INR",
              status: "captured",
              notes: {
                tenantId,
                orderId: String(order._id),
                milestoneIndex: "0",
              },
            },
          },
        },
      };

      const rawBody = JSON.stringify(payload);
      const signature = crypto
        .createHmac("sha256", webhookSecret)
        .update(rawBody)
        .digest("hex");

      const res = await request(app)
        .post("/webhooks/razorpay")
        .set("x-razorpay-signature", signature)
        .set("Content-Type", "application/json")
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);

      // Verify order updated
      const updated = await OrderModel.findById(order._id).lean();
      expect(updated?.financials?.milestones?.[0]?.status).toBe("received");
      expect(updated?.financials?.totalPaidPaise).toBe(1000000);
    });
  });

  // =========================================================================
  // 5. Deliveries & Order Controls (Hold, Resume, Cancel)
  // =========================================================================
  describe("Deliveries & Order Controls (Hold, Resume, Cancel)", () => {
    it("handles partial and full delivery completion", async () => {
      const order = await OrderModel.create({
        tenantId,
        orderNumber: `ORD-DELIV-${Date.now()}`,
        clientId: new Types.ObjectId(clientId),
        productDescription: "Cargo Shorts",
        quantity: 200,
        deliveryDeadline: "2026-12-30",
        spec: { sizes: ["34"] },
        status: "ready_for_delivery",
        quotation: { totalPaise: 2000000 },
        production: { producedQty: 200 },
        financials: {
          milestones: [
            { milestone: "Advance", percent: 100, amountPaise: 2000000, trigger: "advance", status: "received", receivedPaise: 2000000 },
          ],
        },
        version: 1,
      });

      // Partial delivery: 100 of 200
      const resPart = await request(app)
        .post(`/api/v1/orders/${order._id}/deliveries`)
        .set("Authorization", adminToken)
        .set("Idempotency-Key", makeKey())
        .send({
          deliveryDate: "2026-12-20",
          qty: 100,
          invoiceNo: "INV-001",
          invoiceAmountPaise: 1000000,
        });

      expect(resPart.status).toBe(200);
      let updated = await OrderModel.findById(order._id).lean();
      expect(updated?.status).toBe("partially_delivered");
      expect(updated?.deliveries?.length).toBe(1);

      // Final delivery: remaining 100
      const resFull = await request(app)
        .post(`/api/v1/orders/${order._id}/deliveries`)
        .set("Authorization", adminToken)
        .set("Idempotency-Key", makeKey())
        .send({
          deliveryDate: "2026-12-25",
          qty: 100,
          invoiceNo: "INV-002",
          invoiceAmountPaise: 1000000,
        });

      expect(resFull.status).toBe(200);
      updated = await OrderModel.findById(order._id).lean();
      expect(updated?.status).toBe("completed");
    });

    it("puts order on hold, resumes, and releases reserved stock upon cancellation", async () => {
      // 1. Create material
      const mat = await MaterialModel.create({
        tenantId,
        materialName: "Canvas Fabric 10oz",
        type: "yarn",
        unit: "m",
        stockQty: 300,
        reservedQty: 100,
        reorderLevel: 20,
        currentRatePaise: 15000,
        status: "active",
        version: 1,
      });

      // 2. Create order with active reservation
      const order = await OrderModel.create({
        tenantId,
        orderNumber: `ORD-CTRL-${Date.now()}`,
        clientId: new Types.ObjectId(clientId),
        productDescription: "Tote Bags",
        quantity: 100,
        deliveryDeadline: "2026-12-30",
        spec: { sizes: ["OneSize"] },
        status: "in_production",
        production: { assignmentStatus: "started" },
        reservations: [{ materialId: mat._id, qty: 100, status: "active" }],
        version: 1,
      });

      // 3. Hold order
      const resHold = await request(app)
        .post(`/api/v1/orders/${order._id}/hold`)
        .set("Authorization", adminToken)
        .set("Idempotency-Key", makeKey())
        .send({ reason: "Client requested packaging revision" });

      expect(resHold.status).toBe(200);
      let updated = await OrderModel.findById(order._id).lean();
      expect(updated?.status).toBe("on_hold");

      // 4. Resume order
      const resResume = await request(app)
        .post(`/api/v1/orders/${order._id}/resume`)
        .set("Authorization", adminToken)
        .set("Idempotency-Key", makeKey())
        .send();

      expect(resResume.status).toBe(200);
      updated = await OrderModel.findById(order._id).lean();
      expect(updated?.status).toBe("in_production");

      // 5. Cancel order
      const resCancel = await request(app)
        .post(`/api/v1/orders/${order._id}/cancel`)
        .set("Authorization", adminToken)
        .set("Idempotency-Key", makeKey())
        .send({ reason: "Client cancelled before cutting phase" });

      expect(resCancel.status).toBe(200);
      updated = await OrderModel.findById(order._id).lean();
      expect(updated?.status).toBe("cancelled");
      expect(updated?.reservations?.[0]?.status).toBe("released");

      // Verify stock was released in MaterialModel
      const updatedMat = await MaterialModel.findById(mat._id).lean();
      expect(updatedMat?.reservedQty).toBe(0);
    });
  });
});
