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
import { OrderService } from "../../src/services/order.service.js";
import { OrderStatus } from "@loompilot/shared";

function makeKey(): string {
  return `key_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

describe("Quotation Workflow & AI Agent Integration Test Suite", () => {
  let app: any;
  const tenantId = `tenant_quote_${Date.now()}`;
  let adminToken: string;
  let adminUserId: string;
  let clientToken: string;
  let clientId: string;
  let supervisorToken: string;
  const otherTenantId = `tenant_quote_other_${Date.now()}`;
  let otherTenantAdminToken: string;
  let orderService: OrderService;

  beforeAll(async () => {
    app = createApp();
    orderService = new OrderService();
    await ensureDefaultSettings(tenantId);
    await SettingsModel.updateOne(
      { tenantId },
      { $set: { minMarginPct: 10, quoteValidityDays: 7 } },
      { upsert: true }
    );

    const { user: adminUser } = await createTestUser({ tenantId, role: "admin" });
    adminUserId = String(adminUser._id);
    adminToken = generateTestAuthHeader({
      subjectId: adminUserId,
      realm: "user",
      tenantId,
      role: "admin",
    });

    const { account } = await createTestClientAccount({ tenantId });
    clientId = String(account._id);
    clientToken = generateTestAuthHeader({
      subjectId: clientId,
      realm: "client",
      tenantId,
      clientId,
    });

    const { user: supUser } = await createTestUser({ tenantId, role: "supervisor" });
    supervisorToken = generateTestAuthHeader({
      subjectId: String(supUser._id),
      realm: "user",
      tenantId,
      role: "supervisor",
    });

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

  describe("Quotation Approval & Margin Controls", () => {
    it("approves quotation and sets quotation.status to 'approved' with approvedBy and approvedAt", async () => {
      const order = await OrderModel.create({
        tenantId,
        orderNumber: `ORD-APP-${Date.now()}`,
        clientId: new Types.ObjectId(clientId),
        productDescription: "Cotton Polos",
        quantity: 500,
        deliveryDeadline: "2026-12-01",
        spec: { fabric: "cotton", gsm: 180 },
        status: "quotation_pending_approval",
        quotation: {
          unitPricePaise: 40000,
          totalPaise: 20000000,
          etaDate: "2026-12-01",
          status: "pending_approval",
          paymentSchedule: [
            { milestone: "Advance", percent: 40, amountPaise: 8000000, trigger: "advance" },
            { milestone: "Delivery", percent: 60, amountPaise: 12000000, trigger: "stage", stage: "packing" },
          ],
        },
        version: 1,
      });

      const res = await request(app)
        .post(`/api/v1/orders/${order._id}/quotation/approve`)
        .set("Authorization", adminToken)
        .send({
          action: "approve",
          notes: "Approved with standard margin",
        });

      expect(res.status).toBe(200);

      const updated = await OrderModel.findById(order._id).lean();
      expect(updated?.quotation?.status).toBe("approved");
      expect(String(updated?.quotation?.approvedBy)).toBe(adminUserId);
      expect(updated?.quotation?.approvedAt).toBeDefined();
    });

    it("rejects approval when editedMarginPercent is below settings.minMarginPct with BELOW_THRESHOLD", async () => {
      const order = await OrderModel.create({
        tenantId,
        orderNumber: `ORD-MARGIN-${Date.now()}`,
        clientId: new Types.ObjectId(clientId),
        productDescription: "Cotton Polos",
        quantity: 500,
        deliveryDeadline: "2026-12-01",
        spec: { fabric: "cotton", gsm: 180 },
        status: "quotation_pending_approval",
        quotation: {
          unitPricePaise: 40000,
          totalPaise: 20000000,
          etaDate: "2026-12-01",
          status: "pending_approval",
        },
        version: 1,
      });

      const res = await request(app)
        .post(`/api/v1/orders/${order._id}/quotation/approve`)
        .set("Authorization", adminToken)
        .send({
          action: "approve",
          editedMarginPercent: 5, // Below minimum 10%
        });

      expect(res.status).toBe(400);
      expect(res.body.error?.code).toBe("BELOW_THRESHOLD");
    });

    it("handles action 'reject': moves order to rejected_by_admin and sets quotation status to 'rejected'", async () => {
      const order = await OrderModel.create({
        tenantId,
        orderNumber: `ORD-REJ-${Date.now()}`,
        clientId: new Types.ObjectId(clientId),
        productDescription: "Heavy Knit Cardigan",
        quantity: 300,
        deliveryDeadline: "2026-12-01",
        spec: { fabric: "cotton", gsm: 180 },
        status: "quotation_pending_approval",
        quotation: {
          unitPricePaise: 50000,
          totalPaise: 15000000,
          etaDate: "2026-12-01",
          status: "pending_approval",
        },
        version: 1,
      });

      const res = await request(app)
        .post(`/api/v1/orders/${order._id}/quotation/approve`)
        .set("Authorization", adminToken)
        .send({
          action: "reject",
          reason: "Fabric pricing unfeasible for batch size",
        });

      expect(res.status).toBe(200);

      const updated = await OrderModel.findById(order._id).lean();
      expect(updated?.status).toBe("rejected_by_admin");
      expect(updated?.quotation?.status).toBe("rejected");
    });

    it("handles action 'recalculate': calls pricing agent and stores revision", async () => {
      const order = await OrderModel.create({
        tenantId,
        orderNumber: `ORD-RECALC-${Date.now()}`,
        clientId: new Types.ObjectId(clientId),
        productDescription: "Carded Jersey Shirts",
        quantity: 1000,
        deliveryDeadline: "2026-12-15",
        spec: { fabric: "cotton", gsm: 180 },
        status: "quotation_pending_approval",
        quotation: {
          unitPricePaise: 30000,
          totalPaise: 30000000,
          etaDate: "2026-12-15",
          status: "pending_approval",
          paymentSchedule: [
            { milestone: "Advance", percent: 50, amountPaise: 15000000, trigger: "advance" },
            { milestone: "Delivery", percent: 50, amountPaise: 15000000, trigger: "stage", stage: "packing" },
          ],
        },
        version: 1,
      });

      const res = await request(app)
        .post(`/api/v1/orders/${order._id}/quotation/approve`)
        .set("Authorization", adminToken)
        .send({
          action: "recalculate",
          recalculateReason: "discount",
          editedDeliveryDate: "2026-12-20",
          totalPaise: 28000000,
        });

      expect(res.status).toBe(200);

      const updated = await OrderModel.findById(order._id).lean();
      expect(updated?.quotation?.revisions).toBeDefined();
      expect(updated?.quotation?.revisions?.length).toBeGreaterThan(0);
      // Original quotation price stands untouched until client decision
      expect(updated?.quotation?.totalPaise).toBe(30000000);
    });
    it("persists QUOTATION_APPROVED audit log on successful quotation approval", async () => {
      const order = await OrderModel.create({
        tenantId,
        orderNumber: `ORD-AUDIT-${Date.now()}`,
        clientId: new Types.ObjectId(clientId),
        productDescription: "Audit Cotton Polos",
        quantity: 500,
        deliveryDeadline: "2026-12-01",
        spec: { fabric: "cotton", gsm: 180 },
        status: "quotation_pending_approval",
        quotation: {
          unitPricePaise: 40000,
          totalPaise: 20000000,
          etaDate: "2026-12-01",
          status: "pending_approval",
        },
        version: 1,
      });

      const res = await request(app)
        .post(`/api/v1/orders/${order._id}/quotation/approve`)
        .set("Authorization", adminToken)
        .send({
          action: "approve",
          notes: "Approved for audit logging test",
        });

      expect(res.status).toBe(200);

      const audit = await AuditLogModel.findOne({
        tenantId,
        action: "QUOTATION_APPROVED",
        "entity.id": String(order._id),
      }).lean();
      expect(audit).toBeDefined();
    });

    it("rejects approval for non-existent order with 404 Not Found", async () => {
      const fakeId = new Types.ObjectId().toString();
      const res = await request(app)
        .post(`/api/v1/orders/${fakeId}/quotation/approve`)
        .set("Authorization", adminToken)
        .send({ action: "approve" });

      expect(res.status).toBe(404);
    });

    it("rejects approval when order status is not quotation_pending_approval with 400 Bad Request", async () => {
      const order = await OrderModel.create({
        tenantId,
        orderNumber: `ORD-INVALID-STATUS-${Date.now()}`,
        clientId: new Types.ObjectId(clientId),
        productDescription: "Cardigan",
        quantity: 300,
        deliveryDeadline: "2026-12-01",
        spec: { fabric: "cotton", gsm: 180 },
        status: "in_production", // Invalid status for quotation approval
        quotation: {
          unitPricePaise: 50000,
          totalPaise: 15000000,
          etaDate: "2026-12-01",
          status: "pending_approval",
        },
        version: 1,
      });

      const res = await request(app)
        .post(`/api/v1/orders/${order._id}/quotation/approve`)
        .set("Authorization", adminToken)
        .send({ action: "approve" });

      expect(res.status).toBe(400);
      expect(res.body.error?.message || res.body.message).toMatch(/Cannot approve quotation/i);
    });

    it("enforces tenant isolation: rejects quotation approval by another tenant with 404", async () => {
      const order = await OrderModel.create({
        tenantId,
        orderNumber: `ORD-TENANT-ISO-${Date.now()}`,
        clientId: new Types.ObjectId(clientId),
        productDescription: "Denim Pants",
        quantity: 200,
        deliveryDeadline: "2026-12-01",
        spec: { fabric: "cotton", gsm: 240 },
        status: "quotation_pending_approval",
        quotation: {
          unitPricePaise: 60000,
          totalPaise: 12000000,
          etaDate: "2026-12-01",
          status: "pending_approval",
        },
        version: 1,
      });

      // Request with other tenant admin
      const res = await request(app)
        .post(`/api/v1/orders/${order._id}/quotation/approve`)
        .set("Authorization", otherTenantAdminToken)
        .send({ action: "approve" });

      expect(res.status).toBe(404);

      // Verify quotation status did not change
      const unchanged = await OrderModel.findById(order._id).lean();
      expect(unchanged?.quotation?.status).toBe("pending_approval");
    });

    it("enforces RBAC: rejects quotation approval by supervisor role with 403 Forbidden", async () => {
      const order = await OrderModel.create({
        tenantId,
        orderNumber: `ORD-RBAC-SUP-${Date.now()}`,
        clientId: new Types.ObjectId(clientId),
        productDescription: "Tees",
        quantity: 100,
        deliveryDeadline: "2026-12-01",
        spec: { fabric: "cotton", gsm: 180 },
        status: "quotation_pending_approval",
        quotation: {
          unitPricePaise: 30000,
          totalPaise: 3000000,
          etaDate: "2026-12-01",
          status: "pending_approval",
        },
        version: 1,
      });

      const res = await request(app)
        .post(`/api/v1/orders/${order._id}/quotation/approve`)
        .set("Authorization", supervisorToken)
        .send({ action: "approve" });

      expect(res.status).toBe(403);
    });

    it("enforces RBAC: rejects quotation approval by client realm with 403 Forbidden", async () => {
      const order = await OrderModel.create({
        tenantId,
        orderNumber: `ORD-RBAC-CLI-${Date.now()}`,
        clientId: new Types.ObjectId(clientId),
        productDescription: "Polo",
        quantity: 100,
        deliveryDeadline: "2026-12-01",
        spec: { fabric: "cotton", gsm: 180 },
        status: "quotation_pending_approval",
        quotation: {
          unitPricePaise: 30000,
          totalPaise: 3000000,
          etaDate: "2026-12-01",
          status: "pending_approval",
        },
        version: 1,
      });

      const res = await request(app)
        .post(`/api/v1/orders/${order._id}/quotation/approve`)
        .set("Authorization", clientToken)
        .send({ action: "approve" });

      expect(res.status).toBe(403);
    });
  });

  describe("Agent Ingestion & Stale Response Protection", () => {
    it("ingests feasibility report and progresses order from analyzing to quotation_drafting", async () => {
      const order = await OrderModel.create({
        tenantId,
        orderNumber: `ORD-FEAS-${Date.now()}`,
        clientId: new Types.ObjectId(clientId),
        productDescription: "Woven Twill Pants",
        quantity: 400,
        deliveryDeadline: "2026-12-20",
        spec: { fabric: "cotton", gsm: 180 },
        status: "analyzing",
        version: 1,
      });

      const updated = await orderService.ingestFeasibilityReport(
        {
          schemaVersion: "1.0",
          tenantId,
          orderId: String(order._id),
          verdict: "feasible",
          etaDate: "2026-12-18",
          confidenceScore: 0.95,
          reasonsSummary: "All materials and capacities available",
        },
        { id: "agent_gateway", type: "agent" }
      );

      expect(updated.status).toBe(OrderStatus.QUOTATION_DRAFTING);
    });

    it("safely ignores stale feasibility callbacks on orders that progressed past analysis", async () => {
      const order = await OrderModel.create({
        tenantId,
        orderNumber: `ORD-STALE-FEAS-${Date.now()}`,
        clientId: new Types.ObjectId(clientId),
        productDescription: "Woven Twill Pants",
        quantity: 400,
        deliveryDeadline: "2026-12-20",
        spec: { fabric: "cotton", gsm: 180 },
        status: "in_production",
        version: 1,
      });

      const result = await orderService.ingestFeasibilityReport(
        {
          schemaVersion: "1.0",
          tenantId,
          orderId: String(order._id),
          verdict: "at_risk",
          etaDate: "2026-12-25",
        },
        { id: "agent_gateway", type: "agent" }
      );

      // Must remain in_production
      expect(result.status).toBe(OrderStatus.IN_PRODUCTION);
    });

    it("ingests quotation draft and populates validUntil from settings", async () => {
      const order = await OrderModel.create({
        tenantId,
        orderNumber: `ORD-DRAFT-${Date.now()}`,
        clientId: new Types.ObjectId(clientId),
        productDescription: "Crewneck Fleece",
        quantity: 800,
        deliveryDeadline: "2026-12-20",
        spec: { fabric: "cotton", gsm: 180 },
        status: "quotation_drafting",
        version: 1,
      });

      const updated = await orderService.ingestQuotationDraft(
        {
          schemaVersion: "1.0",
          tenantId,
          orderId: String(order._id),
          unitPricePaise: 65000,
          totalPaise: 52000000,
          etaDate: "2026-12-15",
          lineItems: [{ description: "Crewneck Fleece", quantity: 800, unitPricePaise: 65000, totalPaise: 52000000 }],
          paymentSchedule: [
            { milestone: "Advance", percent: 30, amountPaise: 15600000, trigger: "advance" },
            { milestone: "Delivery", percent: 70, amountPaise: 36400000, trigger: "stage", stage: "packing" },
          ],
        },
        { id: "agent_gateway", type: "agent" }
      );

      expect(updated.status).toBe(OrderStatus.QUOTATION_PENDING_APPROVAL);

      const dbOrder = await OrderModel.findById(order._id).lean();
      expect(dbOrder?.quotation?.validUntil).toBeDefined();
      expect(dbOrder?.quotation?.status).toBe("pending_approval");
      expect(dbOrder?.quotation?.totalPaise).toBe(52000000);
    });

    it("safely ignores stale quotation drafts for finalized orders", async () => {
      const order = await OrderModel.create({
        tenantId,
        orderNumber: `ORD-STALE-DRAFT-${Date.now()}`,
        clientId: new Types.ObjectId(clientId),
        productDescription: "Crewneck Fleece",
        quantity: 800,
        deliveryDeadline: "2026-12-20",
        spec: { fabric: "cotton", gsm: 180 },
        status: "completed",
        version: 1,
      });

      const result = await orderService.ingestQuotationDraft(
        {
          schemaVersion: "1.0",
          tenantId,
          orderId: String(order._id),
          unitPricePaise: 65000,
          totalPaise: 52000000,
          etaDate: "2026-12-15",
        },
        { id: "agent_gateway", type: "agent" }
      );

      expect(result.status).toBe(OrderStatus.COMPLETED);
    });

    it("deduplicates revisions with identical agentRunId", async () => {
      const agentRunId = new Types.ObjectId();
      const order = await OrderModel.create({
        tenantId,
        orderNumber: `ORD-DEDUP-${Date.now()}`,
        clientId: new Types.ObjectId(clientId),
        productDescription: "Jogger Pants",
        quantity: 500,
        deliveryDeadline: "2026-12-20",
        spec: { fabric: "cotton", gsm: 180 },
        status: "quotation_sent",
        quotation: {
          unitPricePaise: 40000,
          totalPaise: 20000000,
          etaDate: "2026-12-15",
          status: "sent",
          revisions: [
            {
              revisionNo: 1,
              reasonType: "price_surge",
              oldPricePaise: 20000000,
              newPricePaise: 21500000,
              changePct: 7.5,
              clientReason: "Yarn price hike",
              status: "sent",
              agentRunId,
            },
          ],
        },
        version: 1,
      });

      // Try ingesting duplicate revision with same agentRunId
      await orderService.ingestQuotationRevision(
        {
          schemaVersion: "1.0",
          tenantId,
          orderId: String(order._id),
          reasonType: "price_surge",
          oldPricePaise: 20000000,
          newPricePaise: 21500000,
          changePct: 7.5,
          clientReason: "Yarn price hike",
          agentRunId: String(agentRunId),
        },
        { id: "agent_gateway", type: "agent" }
      );

      const dbOrder = await OrderModel.findById(order._id).lean();
      expect(dbOrder?.quotation?.revisions?.length).toBe(1);
    });
  });

  describe("Quotation Expiry", () => {
    it("rejects clientAcceptQuotation when quotation.validUntil has passed", async () => {
      const order = await OrderModel.create({
        tenantId,
        orderNumber: `ORD-EXP-ACCEPT-${Date.now()}`,
        clientId: new Types.ObjectId(clientId),
        productDescription: "Canvas Totes",
        quantity: 300,
        deliveryDeadline: "2026-12-25",
        spec: { fabric: "cotton", gsm: 180 },
        status: "quotation_sent",
        quotation: {
          unitPricePaise: 25000,
          totalPaise: 7500000,
          etaDate: "2026-12-20",
          validUntil: "2026-01-01", // Long past
          status: "sent",
        },
        version: 1,
      });

      const res = await request(app)
        .post(`/api/v1/client/orders/${order._id}/quotation/accept`)
        .set("Authorization", clientToken)
        .set("Idempotency-Key", makeKey())
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error?.message).toContain("expired");
    });

    it("checkAndExpireQuotations automatically transitions expired sent quotations to OrderStatus.EXPIRED", async () => {
      const order = await OrderModel.create({
        tenantId,
        orderNumber: `ORD-AUTO-EXP-${Date.now()}`,
        clientId: new Types.ObjectId(clientId),
        productDescription: "Canvas Totes",
        quantity: 300,
        deliveryDeadline: "2026-12-25",
        spec: { fabric: "cotton", gsm: 180 },
        status: "quotation_sent",
        quotation: {
          unitPricePaise: 25000,
          totalPaise: 7500000,
          etaDate: "2026-12-20",
          validUntil: "2026-01-01", // Past date
          status: "sent",
        },
        version: 1,
      });

      const expiredCount = await orderService.checkAndExpireQuotations(tenantId);
      expect(expiredCount).toBeGreaterThanOrEqual(1);

      const updated = await OrderModel.findById(order._id).lean();
      expect(updated?.status).toBe("expired");
      expect(updated?.quotation?.status).toBe("expired");
    });
  });
});
