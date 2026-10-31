import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import mongoose, { Types } from "mongoose";
import { createApp } from "../../src/app.js";
import {
  MaterialModel,
  MachineModel,
  OrderModel,
  ProductModel,
  UserModel,
  ClientModel,
} from "../../src/models/index.js";
import {
  createTestUser,
  createTestClientAccount,
  generateTestAuthHeader,
} from "../helpers/auth-helper.js";

function findForbiddenKeys(obj: any, forbiddenKeys: string[], path = ""): string[] {
  const violations: string[] = [];
  if (!obj || typeof obj !== "object") return violations;

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      violations.push(...findForbiddenKeys(item, forbiddenKeys, `${path}[${index}]`));
    });
    return violations;
  }

  for (const key of Object.keys(obj)) {
    const currentPath = path ? `${path}.${key}` : key;
    if (forbiddenKeys.includes(key)) {
      violations.push(currentPath);
    }
    violations.push(...findForbiddenKeys(obj[key], forbiddenKeys, currentPath));
  }

  return violations;
}

describe("Forbidden-Key Deep-Scan Verification (Requirement 3)", () => {
  let app: any;
  const tenantId = `tenant_scan_${Date.now()}`;
  let supervisorToken: string;
  let supervisorId: string;
  let clientToken: string;
  let clientId: string;

  let testMaterialId: string;
  let testMachineId: string;
  let testOrderId: string;
  let testProductId: string;

  beforeAll(async () => {
    app = createApp();

    // 1. Supervisor
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
      processAreas: ["knitting"],
    });

    // 2. Client
    const { account } = await createTestClientAccount({ tenantId });
    clientId = String(account._id);
    clientToken = generateTestAuthHeader({
      subjectId: clientId,
      realm: "client",
      tenantId,
      clientId,
    });

    // 3. Seed Material
    const mat = await MaterialModel.create({
      tenantId,
      materialName: "Modal 40s",
      type: "yarn",
      unit: "kg",
      stockQty: 500,
      reservedQty: 50,
      reorderLevel: 20,
      currentRatePaise: 45000,
      supplierOffers: [
        { supplierId: new Types.ObjectId(), ratePaise: 44000, leadDays: 5, active: true },
      ],
      preferredSupplierId: new Types.ObjectId(),
      status: "active",
      version: 1,
    });
    testMaterialId = String(mat._id);

    // 4. Seed Machine
    const mach = await MachineModel.create({
      tenantId,
      machineCode: `KNIT-01-${Date.now()}`,
      machineName: "Circular Knitter #1",
      processArea: "knitting",
      capacityUnitsPerDay: 400,
      currentStatus: "available",
      machineType: "Circular",
      version: 1,
    });
    testMachineId = String(mach._id);

    // 5. Seed Order
    const ord = await OrderModel.create({
      tenantId,
      orderNumber: `ORD-SCAN-${Date.now()}`,
      clientId: new Types.ObjectId(clientId),
      productDescription: "Custom Modal Tees",
      quantity: 500,
      deliveryDeadline: "2026-12-30",
      spec: { sizes: ["M", "L"] },
      status: "assigned",
      quotation: {
        unitPricePaise: 50000,
        totalPaise: 25000000,
        etaDate: "2026-12-30",
        validUntil: "2026-12-15",
        termsVersion: "v1.0",
        priceVariationClause: "Standard 5% buffer",
        revisions: [],
        processPlan: [
          { stage: "knitting", start: "2026-11-01", end: "2026-11-10", dailyTarget: 50 },
        ],
      },
      production: {
        phase: "knitting",
        assignmentStatus: "assigned",
        assignedSupervisors: [
          { supervisorId: new Types.ObjectId(supervisorId), processes: ["knitting"], acknowledgedAt: null },
        ],
        processPlan: [
          { stage: "knitting", start: "2026-11-01", end: "2026-11-10", dailyTarget: 50 },
        ],
      },
      financials: {
        totalPaidPaise: 10000000,
        advanceReceivedPaise: 10000000,
        milestones: [
          {
            milestone: "Advance",
            percent: 40,
            amountPaise: 10000000,
            trigger: "advance",
            status: "received",
            receivedPaise: 10000000,
            razorpayOrderId: "rzp_secret_123",
          },
        ],
      },
      costing: {
        marginPct: 20,
        marginPaise: 5000000,
        totalCostPaise: 20000000,
      },
      version: 1,
    });
    testOrderId = String(ord._id);

    // 6. Seed Product
    const prod = await ProductModel.create({
      tenantId,
      productName: "Premium Modal Tee",
      category: "T-Shirts",
      basePricePaise: 50000,
      bom: [{ materialId: mat._id, qtyPerUnit: 0.25 }],
      routing: [{ stage: "knitting", seq: 1, stdMinPerUnit: 15 }],
      active: true,
      version: 1,
    });
    testProductId = String(prod._id);
  });

  afterAll(async () => {
    await MaterialModel.deleteMany({ tenantId });
    await MachineModel.deleteMany({ tenantId });
    await OrderModel.deleteMany({ tenantId });
    await ProductModel.deleteMany({ tenantId });
    await UserModel.deleteMany({ tenantId });
    await ClientModel.deleteMany({ tenantId });
  });

  it("Supervisor GET /materials & /materials/:id omit currentRatePaise, supplierOffers, and preferredSupplierId", async () => {
    const forbidden = ["currentRatePaise", "supplierOffers", "preferredSupplierId", "costing", "passwordHash"];

    const resList = await request(app)
      .get("/api/v1/materials")
      .set("Authorization", supervisorToken);
    expect(resList.status).toBe(200);
    expect(findForbiddenKeys(resList.body, forbidden)).toEqual([]);

    const resItem = await request(app)
      .get(`/api/v1/materials/${testMaterialId}`)
      .set("Authorization", supervisorToken);
    expect(resItem.status).toBe(200);
    expect(findForbiddenKeys(resItem.body, forbidden)).toEqual([]);
  });

  it("Supervisor GET /machines & /machines/:id are scoped to supervisor processAreas and omit forbidden keys", async () => {
    const forbidden = ["rates", "pricing", "costing", "passwordHash"];

    const resList = await request(app)
      .get("/api/v1/machines")
      .set("Authorization", supervisorToken);
    expect(resList.status).toBe(200);
    expect(findForbiddenKeys(resList.body, forbidden)).toEqual([]);
    // Scoped to knitting
    expect(resList.body.data.every((m: any) => m.processArea === "knitting")).toBe(true);

    const resItem = await request(app)
      .get(`/api/v1/machines/${testMachineId}`)
      .set("Authorization", supervisorToken);
    expect(resItem.status).toBe(200);
    expect(findForbiddenKeys(resItem.body, forbidden)).toEqual([]);
  });

  it("Supervisor POST /orders/:id/start returns ONLY { id, status, assignmentStatus }", async () => {
    const res = await request(app)
      .post(`/api/v1/orders/${testOrderId}/start`)
      .set("Authorization", supervisorToken)
      .set("Idempotency-Key", `key_start_${Date.now()}`)
      .send();

    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data).sort()).toEqual(["assignmentStatus", "id", "status"].sort());
    expect(findForbiddenKeys(res.body, ["costing", "quotation", "financials", "milestones", "totalPaise"])).toEqual([]);
  });

  it("Supervisor GET /orders/:id uses production.processPlan (not stages) and omits all pricing/financials", async () => {
    const forbidden = [
      "costing",
      "quotation",
      "financials",
      "milestones",
      "totalPaise",
      "unitPricePaise",
      "stages",
      "marginPct",
      "marginPaise",
    ];

    const res = await request(app)
      .get(`/api/v1/orders/${testOrderId}`)
      .set("Authorization", supervisorToken);

    expect(res.status).toBe(200);
    expect(findForbiddenKeys(res.body, forbidden)).toEqual([]);
    expect(res.body.data.production?.processPlan).toBeDefined();
    expect(res.body.data.production?.stages).toBeUndefined();
  });

  it("Client GET /client/orders/:id omits processPlan, lineItems, and razorpayOrderId; includes required client fields", async () => {
    const forbidden = ["lineItems", "razorpayOrderId", "costing", "passwordHash", "assignedSupervisors"];

    const res = await request(app)
      .get(`/api/v1/client/orders/${testOrderId}`)
      .set("Authorization", clientToken);

    expect(res.status).toBe(200);
    // In quotation: no processPlan, no lineItems
    expect(res.body.data.quotation?.processPlan).toBeUndefined();
    expect(res.body.data.quotation?.lineItems).toBeUndefined();
    // In quotation: validUntil, termsVersion, priceVariationClause, revisions present
    expect(res.body.data.quotation?.validUntil).toBe("2026-12-15");
    expect(res.body.data.quotation?.termsVersion).toBe("v1.0");
    expect(res.body.data.quotation?.priceVariationClause).toBe("Standard 5% buffer");
    expect(Array.isArray(res.body.data.quotation?.revisions)).toBe(true);
    // In milestones: no razorpayOrderId
    expect(findForbiddenKeys(res.body, forbidden)).toEqual([]);
  });

  it("Client GET /client/products and /client/products/:id remove tenantId/_id duplicates", async () => {
    const resList = await request(app)
      .get("/api/v1/client/products")
      .set("Authorization", clientToken);
    expect(resList.status).toBe(200);

    for (const item of resList.body.data) {
      expect(item.id).toBeDefined();
      expect(item._id).toBeUndefined();
      expect(item.tenantId).toBeUndefined();
      expect(item.bom).toBeUndefined();
      expect(item.routing).toBeUndefined();
    }

    const resItem = await request(app)
      .get(`/api/v1/client/products/${testProductId}`)
      .set("Authorization", clientToken);
    expect(resItem.status).toBe(200);
    expect(resItem.body.data.id).toBeDefined();
    expect(resItem.body.data._id).toBeUndefined();
    expect(resItem.body.data.tenantId).toBeUndefined();
    expect(resItem.body.data.bom).toBeUndefined();
    expect(resItem.body.data.routing).toBeUndefined();
  });

  it("GET /me for both user and client realms omits passwordHash, lockout, and salt", async () => {
    const forbidden = ["passwordHash", "lockout", "salt"];

    const resUser = await request(app)
      .get("/api/v1/me")
      .set("Authorization", supervisorToken);
    expect(resUser.status).toBe(200);
    expect(findForbiddenKeys(resUser.body, forbidden)).toEqual([]);

    const resClient = await request(app)
      .get("/api/v1/me")
      .set("Authorization", clientToken);
    expect(resClient.status).toBe(200);
    expect(findForbiddenKeys(resClient.body, forbidden)).toEqual([]);
  });
});

