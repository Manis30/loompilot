import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { Types } from "mongoose";
import { createApp } from "../../src/app.js";
import {
  MaterialModel,
  SupplierModel,
  OrderModel,
  StockMovementModel,
} from "../../src/models/index.js";
import {
  createTestUser,
  generateTestAuthHeader,
} from "../helpers/auth-helper.js";

describe("Phase 7: Inventory & Procurement Complete Workflow", () => {
  let app: any;
  const tenantId = `tenant_inv_proc_${Date.now()}`;
  let adminToken: string;
  let supervisorToken: string;
  let adminUser: any;
  let supervisorUser: any;

  beforeAll(async () => {
    app = createApp();

    const admin = await createTestUser({ tenantId, role: "admin" });
    adminUser = admin.user;
    adminToken = generateTestAuthHeader({
      subjectId: String(adminUser._id),
      realm: "user",
      tenantId,
      role: "admin",
    });

    const sup = await createTestUser({ tenantId, role: "supervisor" });
    supervisorUser = sup.user;
    supervisorToken = generateTestAuthHeader({
      subjectId: String(supervisorUser._id),
      realm: "user",
      tenantId,
      role: "supervisor",
    });
  });

  afterAll(async () => {
    await MaterialModel.deleteMany({ tenantId });
    await SupplierModel.deleteMany({ tenantId });
    await OrderModel.deleteMany({ tenantId });
    await StockMovementModel.deleteMany({ tenantId });
  });

  describe("1. Real-time Stock Balances & Rate-Free Projections", () => {
    it("Admin receives full stock balances with currentRatePaise", async () => {
      const material = await MaterialModel.create({
        tenantId,
        materialName: `Cotton 40s ${Date.now()}`,
        type: "yarn",
        unit: "kg",
        stockQty: 500,
        reservedQty: 100,
        reorderLevel: 50,
        currentRatePaise: 32000,
        status: "active",
        version: 1,
      });

      const res = await request(app)
        .get("/api/v1/stock/balances")
        .set("Authorization", adminToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      const found = res.body.data.find((m: any) => String(m.materialId) === String(material._id));
      expect(found).toBeDefined();
      expect(found.currentRatePaise).toBe(32000);
      expect(found.available).toBe(400);
    });

    it("Supervisor receives rate-free stock balances without currentRatePaise", async () => {
      const res = await request(app)
        .get("/api/v1/stock/balances")
        .set("Authorization", supervisorToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      for (const item of res.body.data) {
        expect(item.currentRatePaise).toBeUndefined();
        expect(item.supplierOffers).toBeUndefined();
        expect(item.stockQty).toBeDefined();
        expect(item.reservedQty).toBeDefined();
        expect(item.available).toBeDefined();
      }
    });
  });

  describe("2. Stock Adjustments with Non-Negative Invariant", () => {
    it("Rejects stock adjustment that reduces stockQty below reservedQty", async () => {
      const material = await MaterialModel.create({
        tenantId,
        materialName: `Polyester Thread ${Date.now()}`,
        type: "yarn",
        unit: "kg",
        stockQty: 100,
        reservedQty: 80,
        reorderLevel: 20,
        currentRatePaise: 15000,
        status: "active",
        version: 1,
      });

      // Attempt to decrease stock by 30 (would leave 70 stock, but 80 is reserved)
      const res = await request(app)
        .post("/api/v1/stock/adjust")
        .set("Authorization", adminToken)
        .send({
          materialId: String(material._id),
          deltaQty: -30,
          reason: "Damaged packaging loss",
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_FAILED");

      // Verify stock remained 100
      const refreshed = await MaterialModel.findById(material._id);
      expect(refreshed?.stockQty).toBe(100);
    });

    it("Applies valid positive stock adjustment and records movement", async () => {
      const material = await MaterialModel.create({
        tenantId,
        materialName: `Buttons White ${Date.now()}`,
        type: "trim",
        unit: "pcs",
        stockQty: 500,
        reservedQty: 50,
        reorderLevel: 100,
        currentRatePaise: 200,
        status: "active",
        version: 1,
      });

      const res = await request(app)
        .post("/api/v1/stock/adjust")
        .set("Authorization", adminToken)
        .send({
          materialId: String(material._id),
          deltaQty: 250,
          reason: "Physical audit surplus count",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.stockQty).toBe(750);
      expect(res.body.data.available).toBe(700);

      const refreshed = await MaterialModel.findById(material._id);
      expect(refreshed?.stockQty).toBe(750);

      // Verify movement recorded
      const movement = await StockMovementModel.findOne({
        tenantId,
        materialId: material._id,
        type: "adjust",
      });
      expect(movement).toBeDefined();
      expect(movement?.qty).toBe(250);
      expect(movement?.qtyAfter).toBe(750);
    });
  });

  describe("3. Purchase Decisions on Orders", () => {
    let order: any;
    let material: any;
    let supplier: any;

    beforeAll(async () => {
      supplier = await SupplierModel.create({
        tenantId,
        supplierName: `Fast Dye Chemicals ${Date.now()}`,
        email: `contact_${Date.now()}@fastdye.com`,
        phone: "+919876543299",
        city: "Surat",
        status: "active",
        version: 1,
      });

      material = await MaterialModel.create({
        tenantId,
        materialName: `Reactive Blue Dye ${Date.now()}`,
        type: "dye_chemical",
        unit: "kg",
        stockQty: 50,
        reservedQty: 0,
        reorderLevel: 20,
        currentRatePaise: 45000,
        status: "active",
        version: 1,
      });

      order = await OrderModel.create({
        tenantId,
        clientId: new Types.ObjectId(),
        orderNumber: `ORD-PROC-${Date.now()}`,
        productDescription: "Indigo Dyed Cotton Towels",
        quantity: 2000,
        deliveryDeadline: "2026-12-15",
        spec: { sizes: ["Standard"] },
        status: "client_accepted",
        feasibility: {
          approved: true,
          materialRequirements: [
            { materialId: material._id, req: 100, avail: 40, short: 60 },
          ],
        },
        version: 1,
      });
    });

    it("Creates a purchase decision on an order (POST /api/v1/orders/:id/purchase-decisions)", async () => {
      const res = await request(app)
        .post(`/api/v1/orders/${order._id}/purchase-decisions`)
        .set("Authorization", adminToken)
        .set("Idempotency-Key", `idem-pd-${Date.now()}`)
        .send({
          materialId: String(material._id),
          supplierId: String(supplier._id),
          qty: 60,
          ratePaise: 44000,
          expectedArrivalDate: "2026-11-20",
          supplierOrderNo: "PO-FAST-001",
          notes: "Urgent dye order for run A",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.orderId).toBe(String(order._id));
      expect(res.body.data.decision).toBeDefined();
      expect(res.body.data.decision.qty).toBe(60);
      expect(res.body.data.decision.supplierOrder.status).toBe("ordered");
      expect(res.body.data.decision.supplierOrder.recvQty).toBe(0);

      const refreshedOrder = await OrderModel.findById(order._id);
      expect(refreshedOrder?.purchaseDecisions?.length).toBe(1);
    });

    it("Rejects purchase decision with inactive material", async () => {
      const inactiveMat = await MaterialModel.create({
        tenantId,
        materialName: `Old Inactive Yarn ${Date.now()}`,
        type: "yarn",
        unit: "kg",
        stockQty: 0,
        reservedQty: 0,
        reorderLevel: 0,
        currentRatePaise: 10000,
        status: "inactive",
        version: 1,
      });

      const res = await request(app)
        .post(`/api/v1/orders/${order._id}/purchase-decisions`)
        .set("Authorization", adminToken)
        .send({
          materialId: String(inactiveMat._id),
          qty: 50,
          ratePaise: 10000,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_FAILED");
    });

    it("Updates purchase decision expectedArrivalDate (PATCH /api/v1/orders/:id/purchase-decisions/:decisionId)", async () => {
      const refreshedOrder = await OrderModel.findById(order._id);
      const decisionId = refreshedOrder!.purchaseDecisions![0].decisionId;

      const res = await request(app)
        .patch(`/api/v1/orders/${order._id}/purchase-decisions/${decisionId}`)
        .set("Authorization", adminToken)
        .send({
          expectedArrivalDate: "2026-11-25",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.decision.expectedArrivalDate).toBe("2026-11-25");
    });

    it("Centralized purchase decision listing (GET /api/v1/purchase-decisions)", async () => {
      const res = await request(app)
        .get("/api/v1/purchase-decisions")
        .set("Authorization", adminToken)
        .query({
          materialId: String(material._id),
        });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      const item = res.body.data[0];
      expect(item.orderId).toBe(String(order._id));
      expect(item.materialName).toBe(material.materialName);
      expect(item.supplierName).toBe(supplier.supplierName);
      expect(item.supplierOrder.status).toBe("ordered");
    });

    it("Receiving goods against purchase decision updates recvQty and order status (POST /api/v1/stock/receipt)", async () => {
      const refreshedOrder = await OrderModel.findById(order._id);
      const decision = refreshedOrder!.purchaseDecisions![0];

      // Record partial goods receipt of 30 units
      const res = await request(app)
        .post("/api/v1/stock/receipt")
        .set("Authorization", adminToken)
        .set("Idempotency-Key", `idem-rec-${Date.now()}`)
        .send({
          materialId: String(material._id),
          supplierId: String(supplier._id),
          qty: 30,
          unitCostPaise: 44000,
          orderId: String(order._id),
          purchaseDecisionId: decision.decisionId,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.stockQty).toBe(80); // 50 initial + 30

      // Verify decision is now partially_received
      const updatedOrder = await OrderModel.findById(order._id);
      const updatedDec = updatedOrder!.purchaseDecisions!.find(d => d.decisionId === decision.decisionId);
      expect(updatedDec?.supplierOrder?.recvQty).toBe(30);
      expect(updatedDec?.supplierOrder?.status).toBe("partially_received");

      // Cannot cancel a decision with received items
      const cancelRes = await request(app)
        .patch(`/api/v1/orders/${order._id}/purchase-decisions/${decision.decisionId}`)
        .set("Authorization", adminToken)
        .send({
          status: "cancelled",
        });

      expect(cancelRes.status).toBe(400);
      expect(cancelRes.body.error.code).toBe("VALIDATION_FAILED");
    });
  });

  describe("4. Material Readiness & Stock Consumption in Production", () => {
    let order: any;
    let material: any;

    beforeAll(async () => {
      material = await MaterialModel.create({
        tenantId,
        materialName: `Grey Combed Yarn ${Date.now()}`,
        type: "yarn",
        unit: "kg",
        stockQty: 200,
        reservedQty: 100, // 100 reserved, 100 available
        reorderLevel: 50,
        currentRatePaise: 28000,
        status: "active",
        version: 1,
      });

      order = await OrderModel.create({
        tenantId,
        clientId: new Types.ObjectId(),
        orderNumber: `ORD-READY-${Date.now()}`,
        productDescription: "Carded Jersey Fabric",
        quantity: 500,
        deliveryDeadline: "2026-12-20",
        spec: { sizes: ["One Size"] },
        status: "in_production",
        feasibility: {
          approved: true,
          materialRequirements: [
            { materialId: material._id, req: 100, avail: 100, short: 0 },
          ],
        },
        reservations: [
          { materialId: material._id, qty: 100, status: "active" },
        ],
        version: 1,
      });
    });

    it("Evaluates material readiness as ready when reserved (GET /api/v1/orders/:id/material-readiness)", async () => {
      const res = await request(app)
        .get(`/api/v1/orders/${order._id}/material-readiness`)
        .set("Authorization", supervisorToken);

      expect(res.status).toBe(200);
      expect(res.body.data.isReady).toBe(true);
      expect(res.body.data.materials.length).toBe(1);
      const matStatus = res.body.data.materials[0];
      expect(matStatus.materialId).toBe(String(material._id));
      expect(matStatus.requiredQty).toBe(100);
      expect(matStatus.reservedOnOrder).toBe(100);
      expect(matStatus.status).toBe("reserved");
      expect(matStatus.shortageQty).toBe(0);
    });

    it("Consumes reserved stock during production (POST /api/v1/stock/consume)", async () => {
      const res = await request(app)
        .post("/api/v1/stock/consume")
        .set("Authorization", supervisorToken)
        .set("Idempotency-Key", `idem-cons-${Date.now()}`)
        .send({
          materialId: String(material._id),
          orderId: String(order._id),
          qty: 100,
          reason: "Used 100kg in knitting stage",
        });

      expect(res.status).toBe(201);
      // Before: stock 200, reserved 100.
      // After consuming 100 from reserved: stock 100, reserved 0.
      expect(res.body.data.stockQty).toBe(100);
      expect(res.body.data.reservedQty).toBe(0);
      expect(res.body.data.available).toBe(100);

      // Verify order reservation updated to "consumed"
      const refreshedOrder = await OrderModel.findById(order._id);
      expect(refreshedOrder?.reservations?.[0].status).toBe("consumed");

      // Verify stock movement
      const movement = await StockMovementModel.findOne({
        tenantId,
        orderId: order._id,
        type: "consume",
      });
      expect(movement).toBeDefined();
      expect(movement?.qty).toBe(100);
      expect(movement?.qtyAfter).toBe(100);
    });

    it("Rejects consumption if order is not in assigned or in_production", async () => {
      const submittedOrder = await OrderModel.create({
        tenantId,
        clientId: new Types.ObjectId(),
        orderNumber: `ORD-SUBM-${Date.now()}`,
        productDescription: "Rough Fabric Sample",
        quantity: 100,
        deliveryDeadline: "2026-12-30",
        spec: { sizes: ["S"] },
        status: "submitted",
        version: 1,
      });

      const res = await request(app)
        .post("/api/v1/stock/consume")
        .set("Authorization", supervisorToken)
        .set("Idempotency-Key", `idem-fail-${Date.now()}`)
        .send({
          materialId: String(material._id),
          orderId: String(submittedOrder._id),
          qty: 10,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_FAILED");
    });
  });
});

