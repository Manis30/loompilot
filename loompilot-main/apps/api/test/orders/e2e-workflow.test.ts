import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { Types } from "mongoose";
import { createApp } from "../../src/app.js";
import {
  NotificationModel,
  OrderModel,
  MaterialModel,
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

describe("E2E User Requested 5-Step Quotation & Handover Workflow", () => {
  let app: any;
  const tenantId = `tenant_e2e_${Date.now()}`;
  let adminToken: string;
  let adminUserId: string;
  let supervisorToken: string;
  let supervisorId: string;
  let clientEmail: string;
  let clientPassword: string;
  let clientToken: string;
  let clientId: string;
  let createdOrderId: string;
  let orderNumber: string;

  beforeAll(async () => {
    app = createApp();
    await ensureDefaultSettings(tenantId);

    // Seed stock for both materials required by FakeAgentsClient
    await MaterialModel.create([
      {
        _id: new Types.ObjectId("65f000000000000000000001"),
        tenantId,
        materialName: "Combed Cotton 40s Ne",
        type: "yarn",
        unit: "kg",
        stockQty: 5000,
        reservedQty: 0,
        reorderLevel: 50,
        currentRatePaise: 28500,
        status: "active",
        version: 1,
      },
      {
        _id: new Types.ObjectId("65f000000000000000000002"),
        tenantId,
        materialName: "Reactive Dye Blue",
        type: "dye_chemical",
        unit: "kg",
        stockQty: 1000,
        reservedQty: 0,
        reorderLevel: 10,
        currentRatePaise: 15000,
        status: "active",
        version: 1,
      },
    ]);

    // Setup Admin user
    const { user: adminUser } = await createTestUser({ tenantId, role: "admin" });
    adminUserId = String(adminUser._id);
    adminToken = generateTestAuthHeader({
      subjectId: adminUserId,
      realm: "user",
      tenantId,
      role: "admin",
    });

    // Setup Supervisor user (with knitting processArea)
    const { user: supUser } = await createTestUser({
      tenantId,
      role: "supervisor",
      processAreas: ["knitting"],
    });
    supervisorId = String(supUser._id);
    supervisorToken = generateTestAuthHeader({
      subjectId: supervisorId,
      realm: "user",
      tenantId,
      role: "supervisor",
    });

    // Setup Client Account
    clientEmail = `client_${Date.now()}@textiles.local`;
    const { account, plainPassword } = await createTestClientAccount({
      tenantId,
      email: clientEmail,
    });
    clientId = String(account.clientId);
    clientPassword = plainPassword;
  });

  // Step 1: Login as a client in the client portal
  it("Step 1: Login as a client in the client portal", async () => {
    const res = await request(app)
      .post("/api/v1/client/auth/login")
      .send({
        tenantId,
        email: clientEmail,
        password: clientPassword,
      });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.clientAccount.clientId).toBe(clientId);

    clientToken = `Bearer ${res.body.accessToken}`;
  });

  // Step 2: Create a quotation & verify the quotation is visible for admin for approval
  it("Step 2: Client creates order & quotation is visible for admin for approval", async () => {
    const today = new Date();
    const futureDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    // Client creates an order
    const createRes = await request(app)
      .post("/api/v1/client/orders")
      .set("Authorization", clientToken)
      .set("Idempotency-Key", makeKey())
      .send({
        productDescription: "100% Combed Cotton Single Jersey 180 GSM",
        quantity: 2500,
        deliveryDeadline: futureDate,
        deliveryAddress: "Hub #4, Tirupur Textile Park",
        spec: {
          gsm: 180,
          fabric: "Single Jersey Knitted",
          colours: ["Navy Blue", "Optic White"],
        },
        notes: "Bio-washed silicone finish required",
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data).toBeDefined();
    createdOrderId = String(createRes.body.data.id || createRes.body.data._id);
    orderNumber = createRes.body.data.orderNumber;
    expect(createdOrderId).toBeDefined();
    expect(orderNumber).toMatch(/^ORD-/);

    // Verify order is visible to Admin with status 'quotation_pending_approval'
    const adminCheckRes = await request(app)
      .get(`/api/v1/orders/${createdOrderId}`)
      .set("Authorization", adminToken);

    expect(adminCheckRes.status).toBe(200);
    expect(adminCheckRes.body.data.status).toBe("quotation_pending_approval");
    expect(adminCheckRes.body.data.quotation).toBeDefined();
    expect(adminCheckRes.body.data.quotation.status).toBe("pending_approval");
    expect(adminCheckRes.body.data.quotation.totalPaise).toBeGreaterThan(0);
  });

  // Step 3: Once approved, the quotation should be visible for client in client portal
  it("Step 3: Admin approves & sends quotation, quotation becomes visible for client", async () => {
    // Admin approves quotation
    const approveRes = await request(app)
      .post(`/api/v1/orders/${createdOrderId}/quotation/approve`)
      .set("Authorization", adminToken)
      .set("Idempotency-Key", makeKey())
      .send({
        action: "approve",
        editedMarginPercent: 20,
        notes: "Approved by managing director",
      });

    expect(approveRes.status).toBe(200);

    // Admin dispatches/sends quotation to client
    const sendRes = await request(app)
      .post(`/api/v1/orders/${createdOrderId}/quotation/send`)
      .set("Authorization", adminToken)
      .set("Idempotency-Key", makeKey())
      .send();

    expect(sendRes.status).toBe(200);

    // Client fetches order in client portal: quotation is visible!
    const clientOrderRes = await request(app)
      .get(`/api/v1/client/orders/${createdOrderId}`)
      .set("Authorization", clientToken);

    expect(clientOrderRes.status).toBe(200);
    expect(clientOrderRes.body.data.status).toBe("quotation_ready");
    expect(clientOrderRes.body.data.quotation).toBeDefined();
    expect(clientOrderRes.body.data.quotation.totalPaise).toBeGreaterThan(0);
    expect(clientOrderRes.body.data.quotation.unitPricePaise).toBeGreaterThan(0);
  });

  // Step 4: The client should be able to accept the quotation
  it("Step 4: Client accepts the quotation", async () => {
    // Client accepts using either ID or orderNumber
    const acceptRes = await request(app)
      .post(`/api/v1/client/orders/${createdOrderId}/quotation/accept`)
      .set("Authorization", clientToken)
      .set("Idempotency-Key", makeKey())
      .send({
        deliveryAddress: "Hub #4, Tirupur Textile Park",
        notes: "Client accepted all terms and schedule",
      });

    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.data.status).toBe("confirmed");

    // Check DB status is client_accepted
    const dbOrder = await OrderModel.findById(createdOrderId).lean();
    expect(dbOrder?.status).toBe("client_accepted");
    expect(dbOrder?.quotation?.status).toBe("accepted");
  });

  // Step 5: After approved/accepted, admin has to be intimated as notified that new order has received and able to assign supervisor for that order
  it("Step 5: Admin receives notification and assigns supervisor for that order", async () => {
    // 5a. Admin checks notifications
    const notifications = await NotificationModel.find({
      tenantId,
      type: "quotation_accepted",
    }).lean();

    expect(notifications.length).toBeGreaterThan(0);
    const notif = notifications[0];
    expect(notif.title).toContain(orderNumber);
    expect(notif.body).toContain(orderNumber);

    // 5b. Admin assigns supervisor to order with overrideReason (since advance milestone payment is pending)
    const assignRes = await request(app)
      .post(`/api/v1/orders/${createdOrderId}/assign`)
      .set("Authorization", adminToken)
      .set("Idempotency-Key", makeKey())
      .send({
        assignments: [
          {
            supervisorId,
            processArea: "knitting",
          },
        ],
        overrideReason: "Management director prepayment waiver authorized",
      });

    expect(assignRes.status).toBe(200);

    // Verify order transitioned to 'assigned' and supervisor is recorded
    const finalOrder = await OrderModel.findById(createdOrderId).lean();
    expect(finalOrder?.status).toBe("assigned");
    expect(finalOrder?.production?.assignedSupervisors).toBeDefined();
    expect(finalOrder?.production?.assignedSupervisors?.length).toBeGreaterThan(0);
    expect(String(finalOrder?.production?.assignedSupervisors?.[0]?.supervisorId)).toBe(supervisorId);
  });
});
