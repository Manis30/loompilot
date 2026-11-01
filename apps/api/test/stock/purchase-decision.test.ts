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

describe("Persistent Purchase Decision Persistence Test Suite", () => {
  let app: any;
  const tenantId = `tenant_pd_${Date.now()}`;
  let adminToken: string;
  let adminUserId: string;

  let supervisorToken: string;
  let supervisorUserId: string;

  let clientToken: string;
  let clientId: string;

  const otherTenantId = `tenant_pd_other_${Date.now()}`;
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

    // 3. Client
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

    // 5. Fixture records
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
      orderNumber: `ORD-DEC-${Date.now().toString().slice(-4)}`,
      productDescription: "Cotton Poplin Casual Shirts",
      quantity: 1500,
      deliveryDeadline: "2026-12-20",
      spec: { yarnCount: "40s" },
      status: "client_accepted",
      version: 1,
      purchaseDecisions: [
        {
          decisionId: "pd_pending_1",
          materialId: testMaterial._id,
          supplierId: testSupplier._id,
          qty: 400,
          ratePaise: 28000,
          expectedArrivalDate: "2026-11-15",
          decidedBy: new Types.ObjectId(adminUserId),
          decidedAt: new Date(),
          supplierOrder: {
            orderNo: "PO-TEST-1001",
            status: "ordered",
            recvQty: 0,
          },
        },
        {
          decisionId: "pd_to_reject_1",
          materialId: testMaterial._id,
          supplierId: testSupplier._id,
          qty: 250,
          ratePaise: 28000,
          expectedArrivalDate: "2026-11-18",
          decidedBy: new Types.ObjectId(adminUserId),
          decidedAt: new Date(),
          supplierOrder: {
            orderNo: "PO-TEST-1002",
            status: "ordered",
            recvQty: 0,
          },
        },
        {
          decisionId: "pd_with_received_goods",
          materialId: testMaterial._id,
          supplierId: testSupplier._id,
          qty: 500,
          ratePaise: 28000,
          expectedArrivalDate: "2026-11-10",
          decidedBy: new Types.ObjectId(adminUserId),
          decidedAt: new Date(),
          supplierOrder: {
            orderNo: "PO-TEST-1003",
            status: "ordered",
            recvQty: 200,
          },
        },
      ],
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

  describe("PATCH /api/v1/purchase-decisions/:id", () => {
    it("admin can successfully approve a purchase decision and audit log is recorded", async () => {
      const res = await request(app)
        .patch("/api/v1/purchase-decisions/pd_pending_1")
        .set("Authorization", adminToken)
        .send({
          action: "approve",
          status: "ordered",
          notes: "Admin approval verified for production run",
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.decision).toBeDefined();
      expect(res.body.data.decision.supplierOrder.status).toBe("ordered");

      // Verify audit log
      const audit = await AuditLogModel.findOne({
        tenantId,
        action: "PURCHASE_DECISION_APPROVED",
      }).sort({ createdAt: -1 });
      expect(audit).toBeDefined();
      expect(String(audit?.actor.id)).toBe(adminUserId);
    });

    it("admin can successfully reject a purchase decision with mandatory justification", async () => {
      const res = await request(app)
        .patch("/api/v1/purchase-decisions/pd_to_reject_1")
        .set("Authorization", adminToken)
        .send({
          action: "reject",
          status: "cancelled",
          reason: "Quotation rate exceeds budget threshold. Alternative supplier required.",
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.decision.supplierOrder.status).toBe("cancelled");

      // Verify in DB
      const updatedOrder = await OrderModel.findById(testOrder._id).lean();
      const dec = updatedOrder?.purchaseDecisions?.find((d: any) => d.decisionId === "pd_to_reject_1");
      expect(dec?.supplierOrder?.status).toBe("cancelled");

      // Verify audit log
      const audit = await AuditLogModel.findOne({
        tenantId,
        action: "PURCHASE_DECISION_REJECTED",
      }).sort({ createdAt: -1 });
      expect(audit).toBeDefined();
      expect(audit?.after?.notes).toContain("Quotation rate exceeds budget threshold");
    });

    it("fails with 400 when attempting to cancel an already cancelled decision", async () => {
      const res = await request(app)
        .patch("/api/v1/purchase-decisions/pd_to_reject_1")
        .set("Authorization", adminToken)
        .send({
          action: "reject",
          status: "cancelled",
          reason: "Duplicate cancellation attempt",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
      expect(res.body.message || res.body.error?.message).toContain("already cancelled");
    });

    it("fails with 400 when attempting to reject a decision where goods have already been received", async () => {
      const res = await request(app)
        .patch("/api/v1/purchase-decisions/pd_with_received_goods")
        .set("Authorization", adminToken)
        .send({
          action: "reject",
          status: "cancelled",
          reason: "Attempting to cancel received purchase",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
      expect(res.body.message || res.body.error?.message).toContain("already been received");
    });

    it("allows approving by supplierOrder.orderNo as decision identifier", async () => {
      const res = await request(app)
        .patch("/api/v1/purchase-decisions/PO-TEST-1001")
        .set("Authorization", adminToken)
        .send({
          action: "approve",
          status: "ordered",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.decision.decisionId).toBe("pd_pending_1");
      expect(res.body.data.decision.supplierOrder.status).toBe("ordered");
    });
  });

  describe("PATCH /api/v1/orders/:id/purchase-decisions/:decisionId", () => {
    it("admin can approve purchase decision through the nested order route", async () => {
      const res = await request(app)
        .patch(`/api/v1/orders/${testOrder._id}/purchase-decisions/pd_pending_1`)
        .set("Authorization", adminToken)
        .send({
          action: "approve",
          status: "ordered",
          notes: "Approved via nested order endpoint",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.decision.supplierOrder.status).toBe("ordered");
    });
  });

  describe("RBAC & Multi-tenant Isolation", () => {
    it("client user cannot make purchase decisions (403 Forbidden)", async () => {
      const res = await request(app)
        .patch("/api/v1/purchase-decisions/pd_pending_1")
        .set("Authorization", clientToken)
        .send({
          action: "approve",
          status: "ordered",
        });

      expect(res.status).toBe(403);
    });

    it("cross-tenant access is rejected with 404", async () => {
      const res = await request(app)
        .patch("/api/v1/purchase-decisions/pd_pending_1")
        .set("Authorization", otherTenantToken)
        .send({
          action: "approve",
          status: "ordered",
        });

      expect(res.status).toBe(404);
    });

    it("returns 404 for non-existent purchase decision", async () => {
      const res = await request(app)
        .patch("/api/v1/purchase-decisions/pd_non_existent_9999")
        .set("Authorization", adminToken)
        .send({
          action: "approve",
          status: "ordered",
        });

      expect(res.status).toBe(404);
    });
  });
});
