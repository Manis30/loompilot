import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { Types } from "mongoose";
import { createApp } from "../../src/app.js";
import {
  OrderModel,
  MaterialModel,
  StockMovementModel,
  UserModel,
  ClientModel,
} from "../../src/models/index.js";
import {
  createTestUser,
  generateTestAuthHeader,
} from "../helpers/auth-helper.js";
import { getEnv } from "../../src/config/env.js";
import { getContainer } from "../../src/container.js";
import { RazorpayGateway } from "../../src/integrations/payment/razorpay-gateway.js";

describe("Phase 8: Payment & Delivery Workflows", () => {
  let app: any;
  const tenantId = `tenant_pay_deliv_${Date.now()}`;
  let adminToken: string;
  let supervisorToken: string;
  let clientToken: string;
  let otherClientToken: string;
  let clientId: string;
  let otherClientId: string;

  beforeAll(async () => {
    const env = getEnv();
    const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET || "rzp_webhook_secret_test";
    const baseContainer = getContainer();
    const razorpayGateway = new RazorpayGateway({
      keyId: env.RAZORPAY_KEY_ID || "rzp_test_key_123",
      keySecret: env.RAZORPAY_KEY_SECRET || "rzp_test_secret_123",
      webhookSecret,
    });
    razorpayGateway.createOrder = async (params) => ({
      gatewayOrderId: `order_rzp_${Date.now()}`,
      amountPaise: params.amountPaise,
      currency: params.currency || "INR",
      status: "created",
    });
    app = createApp({
      ...baseContainer,
      paymentGateway: razorpayGateway,
    });

    const admin = await createTestUser({ tenantId, role: "admin" });
    adminToken = generateTestAuthHeader({
      subjectId: String(admin.user._id),
      realm: "user",
      tenantId,
      role: "admin",
    });

    const sup = await createTestUser({ tenantId, role: "supervisor" });
    supervisorToken = generateTestAuthHeader({
      subjectId: String(sup.user._id),
      realm: "user",
      tenantId,
      role: "supervisor",
    });

    // Create client
    const clientDoc = await ClientModel.create({
      tenantId,
      clientName: "Fashion Hub Ltd",
      contactPerson: "Rajesh Kumar",
      email: `client_${Date.now()}@fashionhub.com`,
      phone: "+919876543211",
      city: "Coimbatore",
      status: "active",
      version: 1,
    });
    clientId = String(clientDoc._id);
    clientToken = generateTestAuthHeader({
      subjectId: clientId,
      realm: "client",
      tenantId,
      clientId,
    });

    const otherClientDoc = await ClientModel.create({
      tenantId,
      clientName: "Other Client Retail",
      email: `other_${Date.now()}@other.com`,
      phone: "+919876543212",
      city: "Tirupur",
      status: "active",
      version: 1,
    });
    otherClientId = String(otherClientDoc._id);
    otherClientToken = generateTestAuthHeader({
      subjectId: otherClientId,
      realm: "client",
      tenantId,
      clientId: otherClientId,
    });
  });

  afterAll(async () => {
    await OrderModel.deleteMany({ tenantId });
    await MaterialModel.deleteMany({ tenantId });
    await StockMovementModel.deleteMany({ tenantId });
    await UserModel.deleteMany({ tenantId });
    await ClientModel.deleteMany({ tenantId });
  });

  describe("1. Razorpay Webhook Signatures & Idempotent Processing", () => {
    const env = getEnv();
    const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET || "rzp_webhook_secret_test";

    it("Rejects webhook with missing signature header (400 PAYMENT_SIGNATURE_INVALID)", async () => {
      const res = await request(app)
        .post("/webhooks/razorpay")
        .set("Content-Type", "application/json")
        .send({ event: "payment.captured" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("PAYMENT_SIGNATURE_INVALID");
    });

    it("Rejects webhook with invalid HMAC signature (400 PAYMENT_SIGNATURE_INVALID)", async () => {
      const payload = { event: "payment.captured", id: "evt_123" };
      const res = await request(app)
        .post("/webhooks/razorpay")
        .set("Content-Type", "application/json")
        .set("x-razorpay-signature", "invalid_hmac_hex_string_that_does_not_match")
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("PAYMENT_SIGNATURE_INVALID");
    });

    it("Processes valid payment.captured webhook, credits milestone, and handles deduplication", async () => {
      const order = await OrderModel.create({
        tenantId,
        orderNumber: `ORD-WH-${Date.now()}`,
        clientId: new Types.ObjectId(clientId),
        productDescription: "Cotton T-Shirts 100% Combed",
        quantity: 500,
        deliveryDeadline: "2026-12-15",
        spec: { sizes: ["M", "L"] },
        status: "in_production",
        quotation: {
          totalPaise: 500000,
          unitPrice: 1000,
          etaDate: "2026-12-15",
        },
        financials: {
          totalPaise: 500000,
          totalPaidPaise: 0,
          advanceReceivedPaise: 0,
          milestones: [
            {
              milestone: "Advance Payment (50%)",
              trigger: "advance",
              amountPaise: 250000,
              dueDate: "2026-11-10",
              status: "pending",
              receivedPaise: 0,
              razorpayOrderId: "order_wh_rzp_001",
              receipts: [],
            },
            {
              milestone: "Final Payment (50%)",
              trigger: "stage",
              amountPaise: 250000,
              dueDate: "2026-12-15",
              status: "pending",
              receivedPaise: 0,
              receipts: [],
            },
          ],
        },
        version: 1,
      });

      const paymentId = `pay_wh_${Date.now()}`;
      const payload = {
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: paymentId,
              order_id: "order_wh_rzp_001",
              amount: 250000,
              currency: "INR",
              status: "captured",
              notes: {
                orderId: String(order._id),
                tenantId,
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

      // 1. Initial Webhook Delivery
      const res1 = await request(app)
        .post("/webhooks/razorpay")
        .set("Content-Type", "application/json")
        .set("x-razorpay-signature", signature)
        .send(payload);

      expect(res1.status).toBe(200);
      expect(res1.body.received).toBe(true);

      const refreshed1 = await OrderModel.findById(order._id);
      expect(refreshed1?.financials?.totalPaidPaise).toBe(250000);
      expect(refreshed1?.financials?.advanceReceivedPaise).toBe(250000);
      expect(refreshed1?.financials?.milestones?.[0].status).toBe("received");
      expect(refreshed1?.financials?.milestones?.[0].receivedPaise).toBe(250000);

      // 2. Duplicate Webhook Delivery with exact same paymentId
      const res2 = await request(app)
        .post("/webhooks/razorpay")
        .set("Content-Type", "application/json")
        .set("x-razorpay-signature", signature)
        .send(payload);

      expect(res2.status).toBe(200);
      expect(res2.body.received).toBe(true);
      expect(res2.body.deduplicated).toBe(true);

      // Verify balance did NOT double
      const refreshed2 = await OrderModel.findById(order._id);
      expect(refreshed2?.financials?.totalPaidPaise).toBe(250000);
      expect(refreshed2?.financials?.milestones?.[0].receipts?.length).toBe(1);
    });

    it("Rejects webhook with payment amount exceeding milestone remaining due (400 OVERPAYMENT)", async () => {
      const order = await OrderModel.create({
        tenantId,
        orderNumber: `ORD-WH-OVER-${Date.now()}`,
        clientId: new Types.ObjectId(clientId),
        productDescription: "Carded Polos",
        quantity: 200,
        deliveryDeadline: "2026-12-25",
        spec: { sizes: ["L"] },
        status: "in_production",
        financials: {
          totalPaise: 200000,
          totalPaidPaise: 0,
          milestones: [
            {
              milestone: "Advance (50%)",
              trigger: "advance",
              amountPaise: 100000,
              status: "pending",
              receivedPaise: 0,
              razorpayOrderId: `order_rzp_over_${Date.now()}`,
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
              id: `pay_over_${Date.now()}`,
              order_id: order.financials!.milestones![0].razorpayOrderId,
              amount: 150000, // Exceeds 100000 due
              currency: "INR",
              status: "captured",
              notes: {
                orderId: String(order._id),
                tenantId,
                milestoneIndex: "0",
              },
            },
          },
        },
      };

      const rawBody = JSON.stringify(payload);
      const signature = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");

      const res = await request(app)
        .post("/webhooks/razorpay")
        .set("Content-Type", "application/json")
        .set("x-razorpay-signature", signature)
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("OVERPAYMENT");
    });
  });

  describe("2. Client Payment Order Creation & Access Controls", () => {
    let order: any;

    beforeAll(async () => {
      order = await OrderModel.create({
        tenantId,
        orderNumber: `ORD-CLIENT-PAY-${Date.now()}`,
        clientId: new Types.ObjectId(clientId),
        productDescription: "Denim Jeans",
        quantity: 300,
        deliveryDeadline: "2026-12-28",
        spec: { sizes: ["32", "34"] },
        status: "in_production",
        financials: {
          totalPaise: 300000,
          totalPaidPaise: 0,
          milestones: [
            {
              milestone: "Advance Payment",
              trigger: "advance",
              amountPaise: 150000,
              status: "pending",
              receivedPaise: 0,
              receipts: [],
            },
          ],
        },
        version: 1,
      });
    });

    it("Client can create a Razorpay payment order for their milestone", async () => {
      const res = await request(app)
        .post(`/api/v1/client/orders/${order._id}/payments/0/razorpay-order`)
        .set("Authorization", clientToken)
        .set("Idempotency-Key", `idem-cl-pay-${Date.now()}`);

      expect(res.status).toBe(200);
      expect(res.body.data.gatewayOrderId).toBeDefined();
      expect(res.body.data.amountPaise).toBe(150000);
      expect(res.body.data.currency).toBe("INR");

      // Verify razorpayOrderId saved on milestone
      const refreshed = await OrderModel.findById(order._id);
      expect(refreshed?.financials?.milestones?.[0].razorpayOrderId).toBe(res.body.data.gatewayOrderId);
    });

    it("Refuses other client from creating payment order on someone else's order (404 NOT_FOUND)", async () => {
      const res = await request(app)
        .post(`/api/v1/client/orders/${order._id}/payments/0/razorpay-order`)
        .set("Authorization", otherClientToken)
        .set("Idempotency-Key", `idem-other-pay-${Date.now()}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("3. Manual Payment Receipts & Reversals", () => {
    let order: any;

    beforeAll(async () => {
      order = await OrderModel.create({
        tenantId,
        orderNumber: `ORD-MANUAL-${Date.now()}`,
        clientId: new Types.ObjectId(clientId),
        productDescription: "Woven Shirts",
        quantity: 400,
        deliveryDeadline: "2026-12-31",
        spec: { sizes: ["M", "XL"] },
        status: "in_production",
        financials: {
          totalPaise: 400000,
          totalPaidPaise: 0,
          milestones: [
            {
              milestone: "50% Advance",
              trigger: "advance",
              amountPaise: 200000,
              status: "pending",
              receivedPaise: 0,
              receipts: [],
            },
          ],
        },
        version: 1,
      });
    });

    it("Rejects manual receipt that exceeds milestone amount (400 OVERPAYMENT)", async () => {
      const res = await request(app)
        .post(`/api/v1/orders/${order._id}/payments/manual-receipt`)
        .set("Authorization", adminToken)
        .set("Idempotency-Key", `idem-over-${Date.now()}`)
        .send({
          milestoneIndex: 0,
          amountPaise: 250000, // Exceeds 200000
          method: "neft",
          ref: "UTR-OVER-001",
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("OVERPAYMENT");
    });

    it("Records valid manual receipt and updates milestone status to received", async () => {
      const res = await request(app)
        .post(`/api/v1/orders/${order._id}/payments/manual-receipt`)
        .set("Authorization", adminToken)
        .set("Idempotency-Key", `idem-man-${Date.now()}`)
        .send({
          milestoneIndex: 0,
          amountPaise: 200000,
          method: "neft",
          ref: "UTR-VALID-999",
        });

      expect(res.status).toBe(200);
      const refreshed = await OrderModel.findById(order._id);
      expect(refreshed?.financials?.milestones?.[0].status).toBe("received");
      expect(refreshed?.financials?.totalPaidPaise).toBe(200000);
      expect(refreshed?.financials?.advanceReceivedPaise).toBe(200000);
    });

    it("Rejects duplicate payment reference on the same milestone (409 DUPLICATE)", async () => {
      const res = await request(app)
        .post(`/api/v1/orders/${order._id}/payments/manual-receipt`)
        .set("Authorization", adminToken)
        .set("Idempotency-Key", `idem-dup-ref-${Date.now()}`)
        .send({
          milestoneIndex: 0,
          amountPaise: 50000,
          method: "neft",
          ref: "UTR-VALID-999",
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("DUPLICATE");
    });

    it("Reverses payment receipt with required reason and updates milestone status to pending", async () => {
      const res = await request(app)
        .post(`/api/v1/orders/${order._id}/payments/reverse`)
        .set("Authorization", adminToken)
        .set("Idempotency-Key", `idem-rev-${Date.now()}`)
        .send({
          milestoneIndex: 0,
          receiptIndex: 0,
          reason: "Customer cheque bounced due to signature mismatch",
        });

      expect(res.status).toBe(200);
      const refreshed = await OrderModel.findById(order._id);
      expect(refreshed?.financials?.milestones?.[0].status).toBe("pending");
      expect(refreshed?.financials?.milestones?.[0].receivedPaise).toBe(0);
      expect(refreshed?.financials?.totalPaidPaise).toBe(0);
      expect(refreshed?.financials?.advanceReceivedPaise).toBe(0);
      expect(refreshed?.financials?.milestones?.[0].receipts?.[0].reversedAt).toBeDefined();
    });

    it("Rejects repeated reversal of an already-reversed receipt (400 VALIDATION_FAILED)", async () => {
      const res = await request(app)
        .post(`/api/v1/orders/${order._id}/payments/reverse`)
        .set("Authorization", adminToken)
        .set("Idempotency-Key", `idem-rev-again-${Date.now()}`)
        .send({
          milestoneIndex: 0,
          receiptIndex: 0,
          reason: "Attempting to reverse twice",
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_FAILED");
    });
  });

  describe("4. Delivery, Concurrency Guards & Order Completion", () => {
    let order: any;
    let material: any;

    beforeAll(async () => {
      material = await MaterialModel.create({
        tenantId,
        materialName: `Combed Cotton Yarn ${Date.now()}`,
        type: "yarn",
        unit: "kg",
        stockQty: 500,
        reservedQty: 200,
        reorderLevel: 50,
        currentRatePaise: 25000,
        status: "active",
        version: 1,
      });

      order = await OrderModel.create({
        tenantId,
        orderNumber: `ORD-DELIV-${Date.now()}`,
        clientId: new Types.ObjectId(clientId),
        productDescription: "Cotton Hoodies",
        quantity: 1000,
        deliveryDeadline: "2026-12-01",
        spec: { sizes: ["M", "L", "XL"] },
        status: "ready_for_delivery",
        quotation: {
          totalPaise: 1000000,
          unitPrice: 1000,
          etaDate: "2026-12-01",
        },
        financials: {
          totalPaise: 1000000,
          totalPaidPaise: 1000000,
          milestones: [
            {
              milestone: "100% Full Payment",
              trigger: "stage",
              amountPaise: 1000000,
              status: "received",
              receivedPaise: 1000000,
              receipts: [],
            },
          ],
        },
        reservations: [
          { materialId: material._id, qty: 200, status: "active" },
        ],
        production: {
          deliveredQty: 0,
        },
        version: 1,
      });
    });

    it("Rejects delivery quantity exceeding order remaining quantity (400 VALIDATION_FAILED)", async () => {
      const res = await request(app)
        .post(`/api/v1/orders/${order._id}/deliveries`)
        .set("Authorization", adminToken)
        .set("Idempotency-Key", `idem-del-over-${Date.now()}`)
        .send({
          deliveryDate: "2026-11-28",
          qty: 1200, // Exceeds 1000
          invoiceNo: "INV-1001",
          invoiceAmountPaise: 1200000,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_FAILED");
    });

    it("Rejects cumulative invoice amount exceeding order total value (400 INVOICE_EXCEEDS_ORDER_VALUE)", async () => {
      const res = await request(app)
        .post(`/api/v1/orders/${order._id}/deliveries`)
        .set("Authorization", adminToken)
        .set("Idempotency-Key", `idem-inv-over-${Date.now()}`)
        .send({
          deliveryDate: "2026-11-28",
          qty: 500,
          invoiceNo: "INV-1001",
          invoiceAmountPaise: 1500000, // Exceeds 1000000
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVOICE_EXCEEDS_ORDER_VALUE");
    });

    it("Records partial delivery, moves order to partially_delivered, and calculates onTime", async () => {
      const res = await request(app)
        .post(`/api/v1/orders/${order._id}/deliveries`)
        .set("Authorization", adminToken)
        .set("Idempotency-Key", `idem-part-del-${Date.now()}`)
        .send({
          deliveryDate: "2026-11-25",
          qty: 400,
          invoiceNo: "INV-1001",
          invoiceAmountPaise: 400000,
        });

      expect(res.status).toBe(200);
      const refreshed = await OrderModel.findById(order._id);
      expect(refreshed?.status).toBe("partially_delivered");
      expect(refreshed?.production?.deliveredQty).toBe(400);
      expect(refreshed?.deliveries?.length).toBe(1);
      expect(refreshed?.deliveries?.[0].onTime).toBe(true);
      expect(refreshed?.deliveries?.[0].delayDays).toBe(0);
    });

    it("Fulfills remaining quantity, completes order, and releases remaining stock buffers", async () => {
      const res = await request(app)
        .post(`/api/v1/orders/${order._id}/deliveries`)
        .set("Authorization", adminToken)
        .set("Idempotency-Key", `idem-final-del-${Date.now()}`)
        .send({
          deliveryDate: "2026-12-05", // 4 days past deadline 2026-12-01
          qty: 600,
          invoiceNo: "INV-1002",
          invoiceAmountPaise: 600000,
        });

      expect(res.status).toBe(200);
      const refreshed = await OrderModel.findById(order._id);
      expect(refreshed?.status).toBe("completed");
      expect(refreshed?.production?.deliveredQty).toBe(1000);
      expect(refreshed?.deliveries?.length).toBe(2);

      // Verify delay calculation: 2026-12-05 vs deadline 2026-12-01 = 4 days delay
      const finalDeliv = refreshed?.deliveries?.[1];
      expect(finalDeliv?.onTime).toBe(false);
      expect(finalDeliv?.delayDays).toBe(4);

      // Verify reservation was released
      expect(refreshed?.reservations?.[0].status).toBe("released");

      // Verify material stock reservation released back to available
      const refreshedMat = await MaterialModel.findById(material._id);
      expect(refreshedMat?.reservedQty).toBe(0);

      // Verify movement recorded
      const movement = await StockMovementModel.findOne({
        tenantId,
        orderId: order._id,
        type: "release",
      });
      expect(movement).toBeDefined();
      expect(movement?.qty).toBe(200);
    });
  });
});
