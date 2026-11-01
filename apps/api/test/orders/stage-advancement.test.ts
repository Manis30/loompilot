import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { Types } from "mongoose";
import { createApp } from "../../src/app.js";
import {
  OrderModel,
  UserModel,
  ClientModel,
  SettingsModel,
  AuditLogModel,
} from "../../src/models/index.js";
import {
  createTestUser,
  createTestClientAccount,
  generateTestAuthHeader,
  ensureDefaultSettings,
} from "../helpers/auth-helper.js";
import { OrderStatus } from "@loompilot/shared";

describe("Persistent Order-Stage Advancement Integration Test Suite", () => {
  let app: any;
  const tenantId = `tenant_stage_${Date.now()}`;
  let adminToken: string;
  let adminUserId: string;
  let clientToken: string;
  let clientId: string;
  let supervisorToken: string;
  let supervisorUserId: string;
  let unassignedSupervisorToken: string;
  const otherTenantId = `tenant_stage_other_${Date.now()}`;
  let otherTenantAdminToken: string;

  beforeAll(async () => {
    app = createApp();
    await ensureDefaultSettings(tenantId);
    await SettingsModel.updateOne(
      { tenantId },
      { $set: { minMarginPct: 10, quoteValidityDays: 7 } },
      { upsert: true }
    );

    // Admin user
    const { user: adminUser } = await createTestUser({ tenantId, role: "admin" });
    adminUserId = String(adminUser._id);
    adminToken = generateTestAuthHeader({
      subjectId: adminUserId,
      realm: "user",
      tenantId,
      role: "admin",
    });

    // Client user
    const { account } = await createTestClientAccount({ tenantId });
    clientId = String(account._id);
    clientToken = generateTestAuthHeader({
      subjectId: clientId,
      realm: "client",
      tenantId,
      clientId,
    });

    // Assigned supervisor user
    const { user: supUser } = await createTestUser({ tenantId, role: "supervisor" });
    supervisorUserId = String(supUser._id);
    supervisorToken = generateTestAuthHeader({
      subjectId: supervisorUserId,
      realm: "user",
      tenantId,
      role: "supervisor",
    });

    // Unassigned supervisor user
    const { user: unassignedSup } = await createTestUser({ tenantId, role: "supervisor" });
    unassignedSupervisorToken = generateTestAuthHeader({
      subjectId: String(unassignedSup._id),
      realm: "user",
      tenantId,
      role: "supervisor",
    });

    // Other tenant admin
    const { user: otherAdminUser } = await createTestUser({ tenantId: otherTenantId, role: "admin" });
    otherTenantAdminToken = generateTestAuthHeader({
      subjectId: String(otherAdminUser._id),
      realm: "user",
      tenantId: otherTenantId,
      role: "admin",
    });
  });

  afterAll(async () => {
    const tenants = { $in: [tenantId, otherTenantId] };
    await OrderModel.deleteMany({ tenantId: tenants });
    await UserModel.deleteMany({ tenantId: tenants });
    await ClientModel.deleteMany({ tenantId: tenants });
    await SettingsModel.deleteMany({ tenantId: tenants });
    await AuditLogModel.deleteMany({ tenantId: tenants });
  });

  it("admin advances order stage on assigned order, updates status to in_production, and logs audit", async () => {
    const order = await OrderModel.create({
      tenantId,
      orderNumber: `ORD-STAGE-${Date.now()}`,
      clientId: new Types.ObjectId(clientId),
      productDescription: "100% Combed Cotton Single Jersey",
      quantity: 1000,
      deliveryDeadline: "2026-12-30",
      spec: { fabric: "cotton", gsm: 180 },
      status: OrderStatus.ASSIGNED,
      production: {
        phase: "Dyeing",
        percentComplete: 20,
        producedQty: 200,
        assignedSupervisors: [
          {
            supervisorId: new Types.ObjectId(supervisorUserId),
            processes: ["dyeing", "finishing"],
            assignedAt: new Date(),
          },
        ],
      },
    });

    const res = await request(app)
      .patch(`/api/v1/orders/${order._id}/stage`)
      .set("Authorization", adminToken)
      .send({
        stage: "Finishing",
        producedQty: 450,
        percentComplete: 45,
        notes: "Dyeing completed; moving to stenter finishing",
      });

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.status).toBe(OrderStatus.IN_PRODUCTION);
    expect(res.body.data.production.phase).toBe("Finishing");
    expect(res.body.data.production.producedQty).toBe(450);
    expect(res.body.data.production.percentComplete).toBe(45);

    // Verify DB persistence
    const refreshed = await OrderModel.findById(order._id);
    expect(refreshed?.status).toBe(OrderStatus.IN_PRODUCTION);
    expect(refreshed?.production?.phase).toBe("Finishing");
    expect(refreshed?.production?.producedQty).toBe(450);
    expect(refreshed?.production?.percentComplete).toBe(45);
    expect(refreshed?.production?.stageTotals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: "Finishing",
          produced: 450,
        }),
      ])
    );

    // Verify audit log
    const audit = await AuditLogModel.findOne({
      tenantId,
      action: "ORDER_STAGE_ADVANCED",
      "entity.id": String(order._id),
    });
    expect(audit).toBeDefined();
    expect(audit?.after?.stage).toBe("Finishing");
  });

  it("assigned supervisor advances stage successfully and receives supervisor DTO", async () => {
    const order = await OrderModel.create({
      tenantId,
      orderNumber: `ORD-SUP-STAGE-${Date.now()}`,
      clientId: new Types.ObjectId(clientId),
      productDescription: "Mercerized Cotton Twill",
      quantity: 500,
      deliveryDeadline: "2026-11-20",
      spec: { fabric: "cotton", gsm: 220 },
      status: OrderStatus.IN_PRODUCTION,
      production: {
        phase: "Weaving",
        percentComplete: 50,
        producedQty: 250,
        assignedSupervisors: [
          {
            supervisorId: new Types.ObjectId(supervisorUserId),
            processes: ["weaving"],
            assignedAt: new Date(),
          },
        ],
      },
    });

    const res = await request(app)
      .patch(`/api/v1/orders/${order._id}/stage`)
      .set("Authorization", supervisorToken)
      .send({
        stage: "Inspection",
        producedQty: 350,
        percentComplete: 70,
        notes: "Weaving batch complete; initial inspection underway",
      });

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.production.phase).toBe("Inspection");
    expect(res.body.data.production.producedQty).toBe(350);

    const refreshed = await OrderModel.findById(order._id);
    expect(refreshed?.production?.phase).toBe("Inspection");
    expect(refreshed?.production?.producedQty).toBe(350);
    expect(refreshed?.production?.percentComplete).toBe(70);
  });

  it("unassigned supervisor receives 403 Forbidden", async () => {
    const order = await OrderModel.create({
      tenantId,
      orderNumber: `ORD-UNASSIGNED-${Date.now()}`,
      clientId: new Types.ObjectId(clientId),
      productDescription: "Heavy Canvas",
      quantity: 300,
      deliveryDeadline: "2026-11-25",
      spec: { fabric: "canvas", gsm: 350 },
      status: OrderStatus.IN_PRODUCTION,
      production: {
        phase: "Weaving",
        percentComplete: 30,
        producedQty: 90,
        assignedSupervisors: [
          {
            supervisorId: new Types.ObjectId(supervisorUserId), // only supervisorUserId is assigned
            processes: ["weaving"],
            assignedAt: new Date(),
          },
        ],
      },
    });

    const res = await request(app)
      .patch(`/api/v1/orders/${order._id}/stage`)
      .set("Authorization", unassignedSupervisorToken) // unassigned supervisor attempts advance
      .send({
        stage: "Inspection",
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toBeDefined();
  });

  it("client user receives 403 Forbidden (RBAC violation)", async () => {
    const order = await OrderModel.create({
      tenantId,
      orderNumber: `ORD-CLIENT-STAGE-${Date.now()}`,
      clientId: new Types.ObjectId(clientId),
      productDescription: "Linen Voile",
      quantity: 200,
      deliveryDeadline: "2026-12-10",
      spec: { fabric: "linen", gsm: 110 },
      status: OrderStatus.IN_PRODUCTION,
      production: {
        phase: "Weaving",
        percentComplete: 40,
        producedQty: 80,
      },
    });

    const res = await request(app)
      .patch(`/api/v1/orders/${order._id}/stage`)
      .set("Authorization", clientToken)
      .send({
        stage: "Finishing",
      });

    expect(res.status).toBe(403);
  });

  it("cross-tenant isolation: other tenant admin receives 404 Not Found", async () => {
    const order = await OrderModel.create({
      tenantId,
      orderNumber: `ORD-ISOLATION-${Date.now()}`,
      clientId: new Types.ObjectId(clientId),
      productDescription: "Bamboo Terry",
      quantity: 400,
      deliveryDeadline: "2026-12-05",
      spec: { fabric: "bamboo", gsm: 260 },
      status: OrderStatus.IN_PRODUCTION,
      production: {
        phase: "Knitting",
        percentComplete: 25,
        producedQty: 100,
      },
    });

    const res = await request(app)
      .patch(`/api/v1/orders/${order._id}/stage`)
      .set("Authorization", otherTenantAdminToken)
      .send({
        stage: "Dyeing",
      });

    expect(res.status).toBe(404);
  });

  it("non-existent order ID returns 404", async () => {
    const fakeId = new Types.ObjectId();
    const res = await request(app)
      .patch(`/api/v1/orders/${fakeId}/stage`)
      .set("Authorization", adminToken)
      .send({
        stage: "Dyeing",
      });

    expect(res.status).toBe(404);
  });

  it("invalid status transition: non-production orders (e.g. quotation_pending_approval) return 400", async () => {
    const order = await OrderModel.create({
      tenantId,
      orderNumber: `ORD-INVALID-STATUS-${Date.now()}`,
      clientId: new Types.ObjectId(clientId),
      productDescription: "Poplin Cotton",
      quantity: 800,
      deliveryDeadline: "2026-12-20",
      spec: { fabric: "cotton", gsm: 130 },
      status: OrderStatus.QUOTATION_PENDING_APPROVAL,
    });

    const res = await request(app)
      .patch(`/api/v1/orders/${order._id}/stage`)
      .set("Authorization", adminToken)
      .send({
        stage: "Weaving",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("validation error: empty stage returns 400", async () => {
    const order = await OrderModel.create({
      tenantId,
      orderNumber: `ORD-INVALID-BODY-${Date.now()}`,
      clientId: new Types.ObjectId(clientId),
      productDescription: "Poplin Cotton",
      quantity: 800,
      deliveryDeadline: "2026-12-20",
      spec: { fabric: "cotton", gsm: 130 },
      status: OrderStatus.IN_PRODUCTION,
    });

    const res = await request(app)
      .patch(`/api/v1/orders/${order._id}/stage`)
      .set("Authorization", adminToken)
      .send({
        stage: "",
      });

    expect(res.status).toBe(400);
  });
});
