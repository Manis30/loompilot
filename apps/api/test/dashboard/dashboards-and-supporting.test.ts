import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { Types } from "mongoose";
import { createApp } from "../../src/app.js";
import { getContainer } from "../../src/container.js";
import { createTestUser, generateTestAuthHeader } from "../helpers/auth-helper.js";
import { OrderModel } from "../../src/models/orders/order.model.js";
import { MaterialModel } from "../../src/models/catalog/material.model.js";
import { NotificationModel } from "../../src/models/platform/notification.model.js";
import { ImportJobModel } from "../../src/models/platform/import-job.model.js";
import { AuditLogModel } from "../../src/models/platform/audit-log.model.js";
import { UserModel } from "../../src/models/identity/user.model.js";
import { ClientModel } from "../../src/models/identity/client.model.js";
import { HealthController } from "../../src/controllers/health.controller.js";

describe("Phase 9: Dashboards & Supporting APIs", () => {
  let app: any;
  const tenantId = `tenant_dash_${Date.now()}`;
  let adminToken: string;
  let supervisorToken: string;
  let adminId: string;
  let supervisorId: string;
  let clientId: string;

  beforeAll(async () => {
    app = createApp();

    const admin = await createTestUser({ tenantId, role: "admin" });
    adminId = String(admin.user._id);
    adminToken = generateTestAuthHeader({
      subjectId: adminId,
      realm: "user",
      tenantId,
      role: "admin",
    });

    const sup = await createTestUser({ tenantId, role: "supervisor" });
    supervisorId = String(sup.user._id);
    supervisorToken = generateTestAuthHeader({
      subjectId: supervisorId,
      realm: "user",
      tenantId,
      role: "supervisor",
    });

    const client = await ClientModel.create({
      tenantId,
      clientName: "Dashboard Retailer Ltd",
      contactPerson: "Vikram Mehta",
      email: `client_${Date.now()}@dashretail.com`,
      phone: "+919876543210",
      city: "Surat",
      status: "active",
      version: 1,
    });
    clientId = String(client._id);
  });

  afterAll(async () => {
    await OrderModel.deleteMany({ tenantId });
    await MaterialModel.deleteMany({ tenantId });
    await NotificationModel.deleteMany({ tenantId });
    await ImportJobModel.deleteMany({ tenantId });
    await AuditLogModel.deleteMany({ tenantId });
    await UserModel.deleteMany({ tenantId });
    await ClientModel.deleteMany({ tenantId });
  });

  describe("1. Order & Production Dashboard Summary (GET /api/v1/orders/summary)", () => {
    it("Returns zeroed metrics for an empty tenant", async () => {
      const emptyTenant = `tenant_empty_${Date.now()}`;
      const emptyAdmin = await createTestUser({ tenantId: emptyTenant, role: "admin" });
      const emptyToken = generateTestAuthHeader({
        subjectId: String(emptyAdmin.user._id),
        realm: "user",
        tenantId: emptyTenant,
        role: "admin",
      });

      const res = await request(app)
        .get("/api/v1/orders/summary")
        .set("Authorization", emptyToken);

      expect(res.status).toBe(200);
      expect(res.body.data.totalOrders).toBe(0);
      expect(res.body.data.production.totalTargetQty).toBe(0);
      expect(res.body.data.production.totalProducedQty).toBe(0);
      expect(res.body.data.financials.totalValuePaise).toBe(0);
      expect(res.body.data.financials.totalPaidPaise).toBe(0);

      await UserModel.deleteMany({ tenantId: emptyTenant });
    });

    it("Aggregates order status, production, delivery, and integer-paise financials for Admin", async () => {
      // Create 2 test orders in the tenant
      await OrderModel.create({
        tenantId,
        orderNumber: `ORD-DASH-1-${Date.now()}`,
        clientId,
        productDescription: "Custom Cotton Knitted Fabric",
        quantity: 1000,
        deliveryDeadline: "2026-12-01",
        status: "in_production",
        spec: { garmentType: "shirt", targetGsm: 180 },
        production: {
          phase: "knitting",
          producedQty: 600,
          deliveredQty: 200,
          monitoring: { status: "on_track" },
        },
        quotation: {
          totalPaise: 500000,
          unitPrice: 500,
        },
        financials: {
          totalPaidPaise: 250000,
        },
        deliveries: [
          {
            deliveryDate: "2026-11-15",
            qty: 200,
            invoiceNo: "INV-DASH-01",
            invoiceAmountPaise: 100000,
            onTime: true,
            recordedBy: adminId,
          },
        ],
        version: 1,
      });

      await OrderModel.create({
        tenantId,
        orderNumber: `ORD-DASH-2-${Date.now()}`,
        clientId,
        productDescription: "Custom Cotton Stitched Shirts",
        quantity: 2000,
        deliveryDeadline: "2026-10-01", // in past => delayed
        status: "in_production",
        spec: { garmentType: "shirt", targetGsm: 180 },
        production: {
          phase: "stitching",
          producedQty: 500,
          deliveredQty: 0,
          monitoring: { status: "behind" },
        },
        quotation: {
          totalPaise: 800000,
          unitPrice: 400,
        },
        financials: {
          totalPaidPaise: 400000,
        },
        version: 1,
      });

      const res = await request(app)
        .get("/api/v1/orders/summary")
        .set("Authorization", adminToken);

      expect(res.status).toBe(200);
      const { data } = res.body;

      expect(data.totalOrders).toBe(2);
      expect(data.countsByStatus.in_production).toBe(2);
      expect(data.production.totalTargetQty).toBe(3000);
      expect(data.production.totalProducedQty).toBe(1100);
      expect(data.production.totalDeliveredQty).toBe(200);
      expect(data.production.activeProductionOrders).toBe(2);

      // Performance
      expect(data.performance.delayedCount).toBeGreaterThanOrEqual(1);

      // Financials (in integer paise)
      expect(data.financials).toBeDefined();
      expect(data.financials.totalValuePaise).toBe(1300000);
      expect(data.financials.totalPaidPaise).toBe(650000);
      expect(data.financials.totalPendingPaise).toBe(650000);

      // Deliveries
      expect(data.deliveries.totalDeliveries).toBe(1);
      expect(data.deliveries.totalInvoicedPaise).toBe(100000);
    });

    it("Strips financials when accessed by a Supervisor (Role Protection & DTO Allowlist)", async () => {
      const res = await request(app)
        .get("/api/v1/orders/summary")
        .set("Authorization", supervisorToken);

      expect(res.status).toBe(200);
      const { data } = res.body;

      // Supervisor sees operational metrics
      expect(data.totalOrders).toBe(2);
      expect(data.production.totalTargetQty).toBe(3000);
      expect(data.production.totalProducedQty).toBe(1100);
      expect(data.deliveries).toBeDefined();

      // Financials MUST be completely stripped
      expect(data.financials).toBeUndefined();
    });

    it("Applies client and date filters cleanly", async () => {
      const res = await request(app)
        .get(`/api/v1/orders/summary?clientId=${clientId}&dateFrom=2026-01-01`)
        .set("Authorization", adminToken);

      expect(res.status).toBe(200);
      expect(res.body.data.totalOrders).toBe(2);
    });
  });

  describe("2. Stock & Procurement Summary (GET /api/v1/stock/summary)", () => {
    beforeAll(async () => {
      await MaterialModel.create({
        tenantId,
        materialName: "Cotton Yarn 40s",
        type: "yarn",
        stockQty: 50,
        reservedQty: 10,
        reorderLevel: 100, // low stock!
        currentRatePaise: 45000,
        unit: "kg",
        status: "active",
        version: 1,
      });

      await MaterialModel.create({
        tenantId,
        materialName: "Polyester Thread",
        type: "trim",
        stockQty: 500,
        reservedQty: 50,
        reorderLevel: 100,
        currentRatePaise: 1500,
        unit: "spools",
        status: "active",
        version: 1,
      });

      // Add a purchase decision to an order
      await OrderModel.findOneAndUpdate(
        { tenantId, orderNumber: { $regex: /^ORD-DASH-1/ } },
        {
          $set: {
            purchaseDecisions: [
              {
                decisionId: `pd_${Date.now()}`,
                materialId: new Types.ObjectId(),
                qty: 300,
                ratePaise: 42000,
                status: "ordered",
                supplierOrder: {
                  orderNo: "PO-DASH-001",
                  status: "ordered",
                },
                decidedBy: new Types.ObjectId(adminId),
                decidedAt: new Date(),
              },
            ],
          },
        }
      );
    });

    it("Returns material counts, low-stock alerts, group breakdown, and valuation for Admin", async () => {
      const res = await request(app)
        .get("/api/v1/stock/summary")
        .set("Authorization", adminToken);

      expect(res.status).toBe(200);
      const { data } = res.body;

      expect(data.totalMaterials).toBe(2);
      expect(data.lowStockCount).toBe(1); // Cotton Yarn is <= reorderLevel
      expect(data.byGroup.yarn.count).toBe(1);
      expect(data.byGroup.trim.count).toBe(1);
      expect(data.procurement.activePurchasesCount).toBe(1);
      expect(data.procurement.pendingPurchasesQty).toBe(300);

      // Admin sees total valuation in paise: (50 * 45000) + (500 * 1500) = 2250000 + 750000 = 3000000
      expect(data.totalValuationPaise).toBe(3000000);
    });

    it("Strips valuation when accessed by a Supervisor (Role Protection & DTO Allowlist)", async () => {
      const res = await request(app)
        .get("/api/v1/stock/summary")
        .set("Authorization", supervisorToken);

      expect(res.status).toBe(200);
      const { data } = res.body;

      // Supervisor sees physical quantities
      expect(data.totalMaterials).toBe(2);
      expect(data.lowStockCount).toBe(1);
      expect(data.byGroup).toBeDefined();
      expect(data.procurement).toBeDefined();

      // Commercial valuation MUST be stripped
      expect(data.totalValuationPaise).toBeUndefined();
    });
  });

  describe("3. Notifications (GET & PATCH /api/v1/supervisor/notifications)", () => {
    let notifId: string;

    beforeAll(async () => {
      const notif = await NotificationModel.create({
        tenantId,
        recipient: { userId: supervisorId },
        kind: "alert",
        type: "PRODUCTION_DELAY_ALERT",
        channel: "in_app",
        status: "pending",
        title: "Delay Warning on Order #1001",
        body: "Knitting phase is running 2 days behind schedule.",
        readAt: null,
        version: 1,
      });
      notifId = String(notif._id);
    });

    it("Returns sanitized DTOs with tenant and user isolation", async () => {
      const res = await request(app)
        .get("/api/v1/supervisor/notifications")
        .set("Authorization", supervisorToken);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      const item = res.body.data.find((n: any) => n.id === notifId);
      expect(item).toBeDefined();
      expect(item.id).toBe(notifId);
      expect(item.kind).toBe("alert");
      expect(item.type).toBe("PRODUCTION_DELAY_ALERT");
      expect(item.title).toBe("Delay Warning on Order #1001");
      expect(item.readAt).toBeNull();
      // Internal fields stripped
      expect(item._id).toBeUndefined();
      expect(item.__v).toBeUndefined();
    });

    it("Filters notifications by unreadOnly", async () => {
      const res = await request(app)
        .get("/api/v1/supervisor/notifications?unreadOnly=true")
        .set("Authorization", supervisorToken);

      expect(res.status).toBe(200);
      expect(res.body.data.some((n: any) => n.id === notifId)).toBe(true);
    });

    it("Marks notification as read via PATCH /api/v1/supervisor/notifications/:id/read", async () => {
      const res = await request(app)
        .patch(`/api/v1/supervisor/notifications/${notifId}/read`)
        .set("Authorization", supervisorToken);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(notifId);
      expect(res.body.data.readAt).toBeDefined();
      expect(res.body.data.readAt).not.toBeNull();
    });

    it("Prevents another user or tenant from marking the notification as read (404 NOT_FOUND)", async () => {
      const otherUser = await createTestUser({ tenantId, role: "supervisor" });
      const otherToken = generateTestAuthHeader({
        subjectId: String(otherUser.user._id),
        realm: "user",
        tenantId,
        role: "supervisor",
      });

      const res = await request(app)
        .patch(`/api/v1/supervisor/notifications/${notifId}/read`)
        .set("Authorization", otherToken);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");

      await UserModel.deleteMany({ _id: otherUser.user._id });
    });
  });

  describe("4. CSV Import Idempotency & Double-Commit Protection", () => {
    let validJobId: string;

    beforeAll(async () => {
      const csvData = [
        "materialName,type,currentRatePaise,stockQty,reorderLevel,unit",
        "Imported Silk Yarn,yarn,75000,100,20,kg",
      ].join("\n");

      const dryRunRes = await request(app)
        .post("/api/v1/imports/dry-run")
        .set("Authorization", adminToken)
        .send({
          type: "materials",
          csvContent: csvData,
        });

      expect(dryRunRes.status).toBe(200);
      validJobId = dryRunRes.body.data.jobId;
    });

    it("Successfully commits a dry-run import job", async () => {
      const res = await request(app)
        .post("/api/v1/imports/commit")
        .set("Authorization", adminToken)
        .set("Idempotency-Key", `idem-imp-commit-${Date.now()}`)
        .send({
          jobId: validJobId,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe("completed");
    });

    it("Re-committing an already completed job returns completed job idempotently", async () => {
      const res = await request(app)
        .post("/api/v1/imports/commit")
        .set("Authorization", adminToken)
        .set("Idempotency-Key", `idem-imp-recommit-${Date.now()}`)
        .send({
          jobId: validJobId,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe("completed");
    });

    it("Rejects duplicate commit execution when a job is in processing status (409 DUPLICATE)", async () => {
      const processingJob = await ImportJobModel.create({
        tenantId,
        type: "materials",
        status: "processing",
        rowsOk: 1,
        rowsFailed: 0,
        fileHash: `hash_proc_${Date.now()}`,
        createdBy: adminId,
        version: 1,
      });

      const res = await request(app)
        .post("/api/v1/imports/commit")
        .set("Authorization", adminToken)
        .set("Idempotency-Key", `idem-imp-proc-${Date.now()}`)
        .send({
          jobId: String(processingJob._id),
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("DUPLICATE");
    });
  });

  describe("5. Audit Log Filtering & Safety", () => {
    beforeAll(async () => {
      await AuditLogModel.create({
        tenantId,
        actor: { id: adminId, type: "user" },
        action: "SETTINGS_UPDATED",
        entity: { collection: "settings", id: "default" },
        ip: "127.0.0.1",
        requestId: "req-audit-test-1",
      });
    });

    it("Queries audit logs with pagination and filters", async () => {
      const res = await request(app)
        .get(`/api/v1/audit?actorId=${adminId}&action=SETTINGS_UPDATED`)
        .set("Authorization", adminToken);

      expect(res.status).toBe(200);
      expect(res.body.items).toBeDefined();
      expect(res.body.items.length).toBeGreaterThanOrEqual(1);
    });

    it("Safely handles malformed actorId without throwing 500 CastError", async () => {
      const res = await request(app)
        .get("/api/v1/audit?actorId=not-a-valid-object-id-string")
        .set("Authorization", adminToken);

      expect(res.status).toBe(200);
      expect(res.body.items).toBeDefined();
      expect(res.body.items.length).toBe(0);
    });
  });

  describe("6. Health & Readiness Operational Reliability", () => {
    it("GET /health returns 200 with uptime and status ok", async () => {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
      expect(res.body.uptime).toBeDefined();
    });

    it("GET /ready returns 503 when dependency fails without leaking stack traces or secrets", async () => {
      const baseContainer = getContainer();
      const mockHealthService = {
        getHealth: () => ({ status: "ok" as const, timestamp: new Date().toISOString(), uptime: 10 }),
        getReadiness: () => ({
          status: "not_ready" as const,
          mongo: "disconnected" as const,
          redis: "connected" as const,
          timestamp: new Date().toISOString(),
        }),
      };
      const mockHealthController = new HealthController(mockHealthService as any);
      const appWithFailingDep = createApp({
        ...baseContainer,
        healthService: mockHealthService as any,
        healthController: mockHealthController,
      });

      const res = await request(appWithFailingDep).get("/ready");
      expect(res.status).toBe(503);
      expect(res.body.status).toBe("not_ready");
      expect(res.body.mongo).toBe("disconnected");
      expect(res.body.redis).toBe("connected");
      // No sensitive connection strings or stack traces
      expect(res.body.stack).toBeUndefined();
      expect(res.body.uri).toBeUndefined();
    });
  });
});
