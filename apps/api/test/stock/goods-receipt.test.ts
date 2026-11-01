import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { Types } from "mongoose";
import { createApp } from "../../src/app.js";
import {
  MaterialModel,
  SupplierModel,
  OrderModel,
  StockMovementModel,
  AuditLogModel,
} from "../../src/models/index.js";
import {
  createTestUser,
  createTestClientAccount,
  generateTestAuthHeader,
} from "../helpers/auth-helper.js";

describe("Transactional Goods Receipt (POST /api/v1/stock/receipt)", () => {
  let app: any;
  const tenantId = `tenant_stock_${Date.now()}`;
  const otherTenantId = `tenant_other_${Date.now()}`;
  let adminToken: string;
  let otherTenantAdminToken: string;
  let supervisorToken: string;
  let clientToken: string;

  beforeAll(async () => {
    app = createApp();

    // 1. Admin user
    const { user: adminUser } = await createTestUser({ tenantId, role: "admin" });
    adminToken = generateTestAuthHeader({
      subjectId: String(adminUser._id),
      realm: "user",
      tenantId,
      role: "admin",
    });

    // 2. Other tenant admin
    const { user: otherAdmin } = await createTestUser({ tenantId: otherTenantId, role: "admin" });
    otherTenantAdminToken = generateTestAuthHeader({
      subjectId: String(otherAdmin._id),
      realm: "user",
      tenantId: otherTenantId,
      role: "admin",
    });

    // 3. Supervisor user
    const { user: supUser } = await createTestUser({ tenantId, role: "supervisor" });
    supervisorToken = generateTestAuthHeader({
      subjectId: String(supUser._id),
      realm: "user",
      tenantId,
      role: "supervisor",
    });

    // 4. Client user
    const { clientId } = await createTestClientAccount({ tenantId });
    clientToken = generateTestAuthHeader({
      subjectId: String(clientId),
      realm: "client",
      tenantId,
      clientId: String(clientId),
    });
  });

  afterAll(async () => {
    await MaterialModel.deleteMany({ tenantId: { $in: [tenantId, otherTenantId] } });
    await SupplierModel.deleteMany({ tenantId: { $in: [tenantId, otherTenantId] } });
    await OrderModel.deleteMany({ tenantId: { $in: [tenantId, otherTenantId] } });
    await StockMovementModel.deleteMany({ tenantId: { $in: [tenantId, otherTenantId] } });
    await AuditLogModel.deleteMany({ tenantId: { $in: [tenantId, otherTenantId] } });
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

  it("records direct goods receipt without purchase decision, updating stockQty, ledger, and audit log", async () => {
    const supplier = await SupplierModel.create({
      tenantId,
      supplierName: "Direct Supplier Ltd",
      materialsSupplied: ["Viscose 40s"],
      leadTimeDays: 5,
      city: "Coimbatore",
      phone: "+919876543211",
      email: "supplier@direct.local",
      status: "active",
      version: 1,
    });

    const material = await MaterialModel.create({
      tenantId,
      materialName: "Viscose 40s Staple Yarn",
      type: "yarn",
      unit: "kg",
      stockQty: 80,
      reservedQty: 20,
      reorderLevel: 40,
      currentRatePaise: 28000,
      status: "active",
      version: 1,
    });

    const res = await request(app)
      .post("/api/v1/stock/receipt")
      .set("Authorization", adminToken)
      .set("Idempotency-Key", `idem_direct_${Date.now()}`)
      .send({
        materialId: String(material._id),
        qty: 120,
        unitCostPaise: 28000,
        supplierId: String(supplier._id),
      });

    expect(res.status).toBe(201);
    expect(res.body.data.materialId).toBe(String(material._id));
    expect(res.body.data.stockQty).toBe(200); // 80 + 120
    expect(res.body.data.available).toBe(180); // 200 - 20
    expect(res.body.data.movementId).toBeDefined();

    // Verify DB state
    const updatedMaterial = await MaterialModel.findById(material._id).lean();
    expect(updatedMaterial?.stockQty).toBe(200);

    // Verify StockMovement ledger
    const movement = await StockMovementModel.findById(res.body.data.movementId).lean();
    expect(movement).toBeDefined();
    expect(movement?.type).toBe("receipt");
    expect(movement?.qty).toBe(120);
    expect(movement?.qtyAfter).toBe(200);

    // Verify Audit log
    const audit = await AuditLogModel.findOne({
      tenantId,
      action: "STOCK_GOODS_RECEIPT",
      "entity.id": res.body.data.movementId,
    }).lean();
    expect(audit).toBeDefined();
  });

  it("rejects non-positive quantity (qty <= 0) with 400 Bad Request", async () => {
    const material = await MaterialModel.create({
      tenantId,
      materialName: "Test Material Negative Qty",
      type: "yarn",
      unit: "kg",
      stockQty: 50,
      reservedQty: 0,
      reorderLevel: 10,
      currentRatePaise: 10000,
      status: "active",
      version: 1,
    });

    const supplier = await SupplierModel.create({
      tenantId,
      supplierName: "Test Negative Qty Supplier",
      materialsSupplied: ["Test"],
      leadTimeDays: 2,
      city: "Tirupur",
      phone: "+919876543212",
      email: "supplier@neg.local",
      status: "active",
      version: 1,
    });

    const res = await request(app)
      .post("/api/v1/stock/receipt")
      .set("Authorization", adminToken)
      .set("Idempotency-Key", `idem_neg_${Date.now()}`)
      .send({
        materialId: String(material._id),
        qty: 0,
        unitCostPaise: 10000,
        supplierId: String(supplier._id),
      });

    expect(res.status).toBe(400);

    // Stock must NOT have changed
    const unchanged = await MaterialModel.findById(material._id).lean();
    expect(unchanged?.stockQty).toBe(50);
  });

  it("rejects non-existent material with 404 Not Found", async () => {
    const fakeMaterialId = new Types.ObjectId().toString();
    const supplier = await SupplierModel.create({
      tenantId,
      supplierName: "Test Nonexistent Mat Supplier",
      materialsSupplied: ["Test"],
      leadTimeDays: 2,
      city: "Tirupur",
      phone: "+919876543213",
      email: "supplier@nonmat.local",
      status: "active",
      version: 1,
    });

    const res = await request(app)
      .post("/api/v1/stock/receipt")
      .set("Authorization", adminToken)
      .set("Idempotency-Key", `idem_notfound_mat_${Date.now()}`)
      .send({
        materialId: fakeMaterialId,
        qty: 50,
        unitCostPaise: 10000,
        supplierId: String(supplier._id),
      });

    expect(res.status).toBe(404);
  });

  it("rejects non-existent supplier with 404 Not Found", async () => {
    const material = await MaterialModel.create({
      tenantId,
      materialName: "Test Material Nonexistent Sup",
      type: "yarn",
      unit: "kg",
      stockQty: 50,
      reservedQty: 0,
      reorderLevel: 10,
      currentRatePaise: 10000,
      status: "active",
      version: 1,
    });
    const fakeSupplierId = new Types.ObjectId().toString();

    const res = await request(app)
      .post("/api/v1/stock/receipt")
      .set("Authorization", adminToken)
      .set("Idempotency-Key", `idem_notfound_sup_${Date.now()}`)
      .send({
        materialId: String(material._id),
        qty: 50,
        unitCostPaise: 10000,
        supplierId: fakeSupplierId,
      });

    expect(res.status).toBe(404);

    const unchanged = await MaterialModel.findById(material._id).lean();
    expect(unchanged?.stockQty).toBe(50);
  });

  it("enforces tenant isolation: rejects receipt for material belonging to another tenant", async () => {
    const material = await MaterialModel.create({
      tenantId,
      materialName: "Tenant Isolation Material",
      type: "yarn",
      unit: "kg",
      stockQty: 100,
      reservedQty: 0,
      reorderLevel: 20,
      currentRatePaise: 20000,
      status: "active",
      version: 1,
    });

    const otherSupplier = await SupplierModel.create({
      tenantId: otherTenantId,
      supplierName: "Other Tenant Supplier",
      materialsSupplied: ["Yarn"],
      leadTimeDays: 3,
      city: "Salem",
      phone: "+919876543214",
      email: "supplier@other.local",
      status: "active",
      version: 1,
    });

    // Other tenant attempts to record receipt for material owned by tenantId
    const res = await request(app)
      .post("/api/v1/stock/receipt")
      .set("Authorization", otherTenantAdminToken)
      .set("Idempotency-Key", `idem_tenant_iso_${Date.now()}`)
      .send({
        materialId: String(material._id),
        qty: 50,
        unitCostPaise: 20000,
        supplierId: String(otherSupplier._id),
      });

    expect(res.status).toBe(404);

    // Stock must be untouched
    const untouched = await MaterialModel.findById(material._id).lean();
    expect(untouched?.stockQty).toBe(100);
  });

  it("enforces RBAC: rejects receipt requested by supervisor with 403 Forbidden", async () => {
    const material = await MaterialModel.create({
      tenantId,
      materialName: "RBAC Material Sup",
      type: "yarn",
      unit: "kg",
      stockQty: 100,
      reservedQty: 0,
      reorderLevel: 20,
      currentRatePaise: 20000,
      status: "active",
      version: 1,
    });

    const supplier = await SupplierModel.create({
      tenantId,
      supplierName: "RBAC Supplier Sup",
      materialsSupplied: ["Yarn"],
      leadTimeDays: 3,
      city: "Salem",
      phone: "+919876543215",
      email: "supplier@rbacs.local",
      status: "active",
      version: 1,
    });

    const res = await request(app)
      .post("/api/v1/stock/receipt")
      .set("Authorization", supervisorToken)
      .set("Idempotency-Key", `idem_rbac_sup_${Date.now()}`)
      .send({
        materialId: String(material._id),
        qty: 50,
        unitCostPaise: 20000,
        supplierId: String(supplier._id),
      });

    expect(res.status).toBe(403);
  });

  it("enforces RBAC: rejects receipt requested by client with 403 Forbidden", async () => {
    const material = await MaterialModel.create({
      tenantId,
      materialName: "RBAC Material Client",
      type: "yarn",
      unit: "kg",
      stockQty: 100,
      reservedQty: 0,
      reorderLevel: 20,
      currentRatePaise: 20000,
      status: "active",
      version: 1,
    });

    const supplier = await SupplierModel.create({
      tenantId,
      supplierName: "RBAC Supplier Client",
      materialsSupplied: ["Yarn"],
      leadTimeDays: 3,
      city: "Salem",
      phone: "+919876543216",
      email: "supplier@rbac_cli.local",
      status: "active",
      version: 1,
    });

    const res = await request(app)
      .post("/api/v1/stock/receipt")
      .set("Authorization", clientToken)
      .set("Idempotency-Key", `idem_rbac_cli_${Date.now()}`)
      .send({
        materialId: String(material._id),
        qty: 50,
        unitCostPaise: 20000,
        supplierId: String(supplier._id),
      });

    expect(res.status).toBe(403);
  });

  it("requires Idempotency-Key header on POST /api/v1/stock/receipt", async () => {
    const material = await MaterialModel.create({
      tenantId,
      materialName: "Idempotency Material",
      type: "yarn",
      unit: "kg",
      stockQty: 50,
      reservedQty: 0,
      reorderLevel: 10,
      currentRatePaise: 10000,
      status: "active",
      version: 1,
    });

    const supplier = await SupplierModel.create({
      tenantId,
      supplierName: "Idempotency Supplier",
      materialsSupplied: ["Test"],
      leadTimeDays: 2,
      city: "Tirupur",
      phone: "+919876543217",
      email: "supplier@idem.local",
      status: "active",
      version: 1,
    });

    // Request WITHOUT Idempotency-Key header
    const res = await request(app)
      .post("/api/v1/stock/receipt")
      .set("Authorization", adminToken)
      .send({
        materialId: String(material._id),
        qty: 10,
        unitCostPaise: 10000,
        supplierId: String(supplier._id),
      });

    expect(res.status).toBe(400);
    const msg = res.body.message || res.body.error?.message || JSON.stringify(res.body);
    expect(msg).toMatch(/Idempotency-Key/i);
  });
});
