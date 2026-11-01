import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { Types } from "mongoose";
import { createApp } from "../../src/app.js";
import {
  MaterialModel,
  SupplierModel,
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

describe("Persistent Purchase Request Creation Test Suite", () => {
  let app: any;
  const tenantId = `tenant_pr_${Date.now()}`;
  let adminToken: string;
  let adminUserId: string;

  let supervisorToken: string;
  let supervisorUserId: string;

  let clientToken: string;
  let clientId: string;

  const otherTenantId = `tenant_pr_other_${Date.now()}`;
  let otherTenantToken: string;

  let testOrder: any;
  let testMaterial: any;
  let testSupplier: any;

  beforeAll(async () => {
    app = createApp();
    await ensureDefaultSettings(tenantId);
    await ensureDefaultSettings(otherTenantId);

    // 1. Admin
    const { user: adminUser } = await createTestUser({ tenantId, role: "admin" });
    adminUserId = String(adminUser._id);
    adminToken = generateTestAuthHeader({
      subjectId: adminUserId,
      realm: "user",
      tenantId,
      role: "admin",
    });

    // 2. Supervisor
    const { user: supUser } = await createTestUser({ tenantId, role: "supervisor" });
    supervisorUserId = String(supUser._id);
    supervisorToken = generateTestAuthHeader({
      subjectId: supervisorUserId,
      realm: "user",
      tenantId,
      role: "supervisor",
    });

    // 3. Client user
    const { account } = await createTestClientAccount({ tenantId });
    clientId = String(account._id);
    clientToken = generateTestAuthHeader({
      subjectId: clientId,
      realm: "client",
      tenantId,
      clientId,
    });

    // 4. Other tenant admin
    const { user: otherAdmin } = await createTestUser({ tenantId: otherTenantId, role: "admin" });
    otherTenantToken = generateTestAuthHeader({
      subjectId: String(otherAdmin._id),
      realm: "user",
      tenantId: otherTenantId,
      role: "admin",
    });

    // 5. Shared test data
    testSupplier = await SupplierModel.create({
      tenantId,
      supplierName: "Vardhman Textiles Ltd",
      email: "procurement@vardhman.local",
      phone: "+919876500001",
      city: "Ludhiana",
      status: "active",
      version: 1,
    });

    testMaterial = await MaterialModel.create({
      tenantId,
      materialName: "40s Combed Cotton Yarn",
      type: "yarn",
      unit: "kg",
      stockQty: 800,
      reservedQty: 300,
      reorderLevel: 200,
      currentRatePaise: 28000,
      status: "active",
      version: 1,
    });

    testOrder = await OrderModel.create({
      tenantId,
      clientId: new Types.ObjectId(),
      orderNumber: `ORD-REQ-${Date.now().toString().slice(-4)}`,
      productDescription: "Cotton Poplin Casual Shirts",
      quantity: 1500,
      deliveryDeadline: "2026-12-20",
      spec: { yarnCount: "40s" },
      status: "client_accepted",
      version: 1,
    });
  });

  afterAll(async () => {
    const tenants = { $in: [tenantId, otherTenantId] };
    await OrderModel.deleteMany({ tenantId: tenants });
    await MaterialModel.deleteMany({ tenantId: tenants });
    await SupplierModel.deleteMany({ tenantId: tenants });
    await UserModel.deleteMany({ tenantId: tenants });
    await ClientModel.deleteMany({ tenantId: tenants });
    await SettingsModel.deleteMany({ tenantId: tenants });
    await AuditLogModel.deleteMany({ tenantId: tenants });
  });

  describe("POST /api/v1/purchase-decisions (Direct Purchase Request Endpoint)", () => {
    it("admin can successfully create a purchase request with real material and order IDs", async () => {
      const res = await request(app)
        .post("/api/v1/purchase-decisions")
        .set("Authorization", adminToken)
        .send({
          orderId: String(testOrder._id),
          materialId: String(testMaterial._id),
          supplierId: String(testSupplier._id),
          qty: 400,
          ratePaise: 28000,
          expectedArrivalDate: "2026-11-15",
          notes: "400 kg shortage on Order after yarn reservation",
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.orderId).toBe(String(testOrder._id));
      expect(res.body.data.decision).toBeDefined();
      expect(res.body.data.decision.qty).toBe(400);
      expect(res.body.data.decision.ratePaise).toBe(28000);
      expect(res.body.data.decision.supplierOrder.status).toBe("ordered");

      // Verify persisted in MongoDB
      const updatedOrder = await OrderModel.findById(testOrder._id);
      const persistedDecision = updatedOrder?.purchaseDecisions?.find(
        (d: any) => d.decisionId === res.body.data.decision.decisionId
      );
      expect(persistedDecision).toBeDefined();
      expect(persistedDecision?.qty).toBe(400);

      // Verify audit log
      const audit = await AuditLogModel.findOne({
        tenantId,
        action: "PURCHASE_DECISION_CREATED",
        "entity.id": String(testOrder._id),
      });
      expect(audit).toBeTruthy();
    });

    it("supervisor can successfully create a purchase request", async () => {
      const res = await request(app)
        .post("/api/v1/purchase-decisions")
        .set("Authorization", supervisorToken)
        .send({
          orderId: String(testOrder._id),
          materialId: String(testMaterial._id),
          qty: 200,
          notes: "Supervisor yarn buffer requisition",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.decision.qty).toBe(200);
      expect(res.body.data.decision.ratePaise).toBe(28000); // defaults to material's currentRatePaise
    });

    it("resolves order by human orderNumber (e.g. 'ORD-REQ-...')", async () => {
      const res = await request(app)
        .post("/api/v1/purchase-decisions")
        .set("Authorization", adminToken)
        .send({
          orderId: testOrder.orderNumber,
          materialId: String(testMaterial._id),
          qty: 150,
          notes: "Referencing by orderNumber string",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.orderId).toBe(String(testOrder._id));
      expect(res.body.data.decision.qty).toBe(150);
    });

    it("rejects invalid input schema (missing orderId, negative quantity) with 400 VALIDATION_FAILED", async () => {
      const res = await request(app)
        .post("/api/v1/purchase-decisions")
        .set("Authorization", adminToken)
        .send({
          materialId: String(testMaterial._id),
          qty: -50,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_FAILED");
    });

    it("returns 404 NOT_FOUND when order does not exist", async () => {
      const fakeOrderId = new Types.ObjectId();
      const res = await request(app)
        .post("/api/v1/purchase-decisions")
        .set("Authorization", adminToken)
        .send({
          orderId: String(fakeOrderId),
          materialId: String(testMaterial._id),
          qty: 100,
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("returns 404 NOT_FOUND when material does not exist", async () => {
      const fakeMatId = new Types.ObjectId();
      const res = await request(app)
        .post("/api/v1/purchase-decisions")
        .set("Authorization", adminToken)
        .send({
          orderId: String(testOrder._id),
          materialId: String(fakeMatId),
          qty: 100,
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("blocks client account with 403 FORBIDDEN", async () => {
      const res = await request(app)
        .post("/api/v1/purchase-decisions")
        .set("Authorization", clientToken)
        .send({
          orderId: String(testOrder._id),
          materialId: String(testMaterial._id),
          qty: 100,
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("cross-tenant isolation: cannot create purchase decision against another tenant's order", async () => {
      // Create order belonging to other tenant
      const foreignOrder = await OrderModel.create({
        tenantId: otherTenantId,
        clientId: new Types.ObjectId(),
        orderNumber: `ORD-FOREIGN-${Date.now().toString().slice(-4)}`,
        productDescription: "Foreign Mill Linen Shirts",
        quantity: 500,
        deliveryDeadline: "2026-12-25",
        spec: { fabric: "Linen" },
        status: "client_accepted",
        version: 1,
      });

      // Attempt to add purchase request to foreign order using our tenant's token
      const res = await request(app)
        .post("/api/v1/purchase-decisions")
        .set("Authorization", adminToken)
        .send({
          orderId: String(foreignOrder._id),
          materialId: String(testMaterial._id),
          qty: 100,
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");

      // Verify foreign order has no purchase decisions
      const unChanged = await OrderModel.findById(foreignOrder._id);
      expect(unChanged?.purchaseDecisions?.length || 0).toBe(0);
    });
  });

  describe("POST /api/v1/orders/:id/purchase-decisions (Order Sub-resource Endpoint)", () => {
    it("can create purchase decision via order sub-resource route", async () => {
      const res = await request(app)
        .post(`/api/v1/orders/${testOrder._id}/purchase-decisions`)
        .set("Authorization", adminToken)
        .set("Idempotency-Key", `idem-pd-sub-${Date.now()}`)
        .send({
          materialId: String(testMaterial._id),
          qty: 250,
          ratePaise: 28000,
          notes: "Sub-resource route creation",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.orderId).toBe(String(testOrder._id));
      expect(res.body.data.decision.qty).toBe(250);
    });
  });
});
