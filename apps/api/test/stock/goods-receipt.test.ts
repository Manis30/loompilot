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

describe("Transactional Goods Receipt (POST /api/v1/stock/receipt)", () => {
  let app: any;
  const tenantId = `tenant_stock_${Date.now()}`;
  let adminToken: string;

  beforeAll(async () => {
    app = createApp();
    const { user } = await createTestUser({ tenantId, role: "admin" });
    adminToken = generateTestAuthHeader({
      subjectId: String(user._id),
      realm: "user",
      tenantId,
      role: "admin",
    });
  });

  afterAll(async () => {
    await MaterialModel.deleteMany({ tenantId });
    await SupplierModel.deleteMany({ tenantId });
    await OrderModel.deleteMany({ tenantId });
    await StockMovementModel.deleteMany({ tenantId });
  });

  it("updates supplierOrder status/recvQty/recvAt, stockMovements (purchaseDecisionRef), and materials.stockQty in ONE transaction", async () => {
    // 1. Create supplier
    const supplier = await SupplierModel.create({
      tenantId,
      supplierName: "Apex Yarns Ltd",
      materialsSupplied: ["Cotton 30s"],
      leadTimeDays: 7,
      city: "Tirupur",
      phone: "+919876543210",
      email: "supplier@apex.local",
      status: "active",
      version: 1,
    });

    // 2. Create material
    const material = await MaterialModel.create({
      tenantId,
      materialName: "Cotton 30s Combed",
      type: "yarn",
      unit: "kg",
      stockQty: 100,
      reservedQty: 0,
      reorderLevel: 50,
      currentRatePaise: 25000,
      status: "active",
      version: 1,
    });

    // 3. Create order with purchase decision
    const decisionId = `PD_${Date.now()}`;
    const order = await OrderModel.create({
      tenantId,
      clientId: new Types.ObjectId(),
      orderNumber: `ORD-${Date.now()}`,
      productDescription: "Cotton T-Shirts 100% Combed",
      quantity: 1000,
      deliveryDeadline: "2026-12-01",
      spec: { sizes: ["M", "L"] },
      status: "in_production",
      purchaseDecisions: [
        {
          decisionId,
          materialId: material._id,
          supplierId: supplier._id,
          qty: 250,
          ratePaise: 25000,
          expectedArrivalDate: "2026-11-15",
          decidedBy: new Types.ObjectId(),
          decidedAt: new Date(),
          supplierOrder: {
            orderNo: `SO-${Date.now()}`,
            status: "ordered",
            recvQty: 0,
          },
        },
      ],
      version: 1,
    });

    // 4. Record goods receipt against this purchase decision
    const res = await request(app)
      .post("/api/v1/stock/receipt")
      .set("Authorization", adminToken)
      .set("Idempotency-Key", `idem_receipt_${Date.now()}`)
      .send({
        materialId: String(material._id),
        qty: 250,
        unitCostPaise: 25000,
        supplierId: String(supplier._id),
        orderId: String(order._id),
        purchaseDecisionId: decisionId,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.stockQty).toBe(350); // 100 + 250

    // 5. Verify Material stockQty updated
    const updatedMaterial = await MaterialModel.findById(material._id).lean();
    expect(updatedMaterial?.stockQty).toBe(350);

    // 6. Verify stockMovements ledger contains purchaseDecisionRef
    const movement = await StockMovementModel.findOne({
      tenantId,
      materialId: material._id,
      type: "receipt",
    }).lean();
    expect(movement).toBeDefined();
    expect(movement?.qty).toBe(250);
    expect(movement?.qtyAfter).toBe(350);
    expect(movement?.purchaseDecisionRef).toBeDefined();
    expect(String(movement?.purchaseDecisionRef?.orderId)).toBe(String(order._id));
    expect(movement?.purchaseDecisionRef?.decisionId).toBe(decisionId);

    // 7. Verify Order purchaseDecisions.$.supplierOrder updated
    const updatedOrder = await OrderModel.findById(order._id).lean();
    const pd = updatedOrder?.purchaseDecisions?.find((d) => d.decisionId === decisionId);
    expect(pd).toBeDefined();
    expect(pd?.supplierOrder?.recvQty).toBe(250);
    expect(pd?.supplierOrder?.status).toBe("received");
    expect(pd?.supplierOrder?.recvAt).toBeDefined();
  });
});
