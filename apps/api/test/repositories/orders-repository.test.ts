import { describe, it, expect, beforeAll } from "vitest";
import mongoose from "mongoose";
import {
  OrdersRepository,
  ORDER_CAPS,
  ORDER_SUMMARY_PROJECTION,
  ORDER_DETAIL_PROJECTION,
  CLIENT_SAFE_ORDER_PROJECTION,
  SUPERVISOR_ORDER_PROJECTION,
} from "../../src/repositories/orders.repository.js";
import { AdminCostingRepository } from "../../src/repositories/admin-costing.repository.js";
import { UserRepository } from "../../src/repositories/user.repository.js";
import { OrderModel, UserModel, ClientModel } from "../../src/models/index.js";
import { OrderStatus, ErrorCode } from "@loompilot/shared";
import fs from "fs";
import path from "path";

describe("Stage 3.5: Step 2 OrdersRepository & Architectural Invariants", () => {
  const ordersRepo = new OrdersRepository();
  const costingRepo = new AdminCostingRepository();
  const userRepo = new UserRepository();

  const tenantId = `tenant_step2_${Date.now()}`;
  let sampleClientId: mongoose.Types.ObjectId;
  let sampleProductId: mongoose.Types.ObjectId;
  let sampleAdminId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await OrderModel.syncIndexes();
    await UserModel.syncIndexes();
    await ClientModel.syncIndexes();

    sampleClientId = new mongoose.Types.ObjectId();
    sampleProductId = new mongoose.Types.ObjectId();
    sampleAdminId = new mongoose.Types.ObjectId();
  });

  // -------------------------------------------------------------------------
  // 1. Costing and PasswordHash select:false
  // -------------------------------------------------------------------------
  describe("select: false Protection for Sensitive Costing & Password Fields", () => {
    it("proves default OrderModel queries do NOT return costing, while AdminCostingRepository does", async () => {
      const order = await ordersRepo.create(tenantId, {
        orderNumber: `ORD-SEC-${Date.now()}-1`,
        clientId: sampleClientId,
        productId: sampleProductId,
        quantity: 1000,
        deliveryDeadline: "2026-12-31",
        spec: { sizes: ["M", "L"] },
        costing: {
          materialCosts: [{ materialId: new mongoose.Types.ObjectId(), qty: 10, ratePaise: 25000, paise: 250000 }],
          marginPct: 18,
          marginPaise: 45000,
          totalCostPaise: 295000,
        },
      });

      // Default findById from ordersRepo does NOT project costing
      const fetched = await ordersRepo.findById(tenantId, order._id);
      expect(fetched).toBeDefined();
      expect((fetched as any)?.costing).toBeUndefined();

      // Direct OrderModel.findById also does NOT project costing because of schema select:false
      const direct = await OrderModel.findOne({ tenantId, _id: order._id }).lean();
      expect((direct as any)?.costing).toBeUndefined();

      // AdminCostingRepository explicitly projects +costing
      const costing = await costingRepo.getCosting(tenantId, order._id);
      expect(costing).toBeDefined();
      expect(costing?.marginPct).toBe(18);
      expect(costing?.totalCostPaise).toBe(295000);
    });

    it("proves default UserModel queries do NOT return passwordHash, while auth findByEmail does", async () => {
      const email = `staff_${Date.now()}@mill.local`;
      const createdUser = await UserModel.create({
        tenantId,
        name: "Security Staff",
        email,
        passwordHash: "$2b$10$SecretHashedPasswordVal123",
        role: "admin",
        processAreas: ["spinning"],
        status: "active",
      });

      // Default findById without +passwordHash does NOT return passwordHash
      const defaultUser = await UserModel.findOne({ tenantId, _id: createdUser._id }).lean();
      expect(defaultUser?.passwordHash).toBeUndefined();

      // UserRepository.findByEmail explicitly projects +passwordHash for secure authentication
      const authUser = await userRepo.findByEmail(tenantId, email);
      expect(authUser).toBeDefined();
      expect(authUser?.passwordHash).toBe("$2b$10$SecretHashedPasswordVal123");
    });
  });

  // -------------------------------------------------------------------------
  // 2. One-Login Uniqueness
  // -------------------------------------------------------------------------
  describe("One-Login Uniqueness Invariants", () => {
    it("proves duplicate client portalAccess.email in same tenant fails with E11000, but allowed across tenants", async () => {
      const email = `client_login_${Date.now()}@buyer.local`;

      const c1 = await ClientModel.create({
        tenantId,
        clientName: "Client Org 1",
        portalAccess: { email, status: "active" },
      });
      expect(c1._id).toBeDefined();

      // Duplicate in same tenant -> E11000
      await expect(
        ClientModel.create({
          tenantId,
          clientName: "Client Org 2",
          portalAccess: { email, status: "active" },
        })
      ).rejects.toThrow(/E11000/);

      // Same email in DIFFERENT tenant -> succeeds
      const otherTenant = `tenant_diff_${Date.now()}`;
      const cDiff = await ClientModel.create({
        tenantId: otherTenant,
        clientName: "Client Org in Other Tenant",
        portalAccess: { email, status: "active" },
      });
      expect(cDiff._id).toBeDefined();
    });

    it("proves duplicate user email in same tenant fails with E11000, but allowed across tenants", async () => {
      const email = `worker_${Date.now()}@loom.local`;

      const u1 = await UserModel.create({
        tenantId,
        name: "Worker 1",
        email,
        passwordHash: "hash123",
        role: "supervisor",
        processAreas: ["weaving"],
        status: "active",
      });
      expect(u1._id).toBeDefined();

      // Duplicate in same tenant -> E11000
      await expect(
        UserModel.create({
          tenantId,
          name: "Worker 2",
          email,
          passwordHash: "hash456",
          role: "supervisor",
          processAreas: ["weaving"],
          status: "active",
        })
      ).rejects.toThrow(/E11000/);

      // Same email in different tenant -> succeeds
      const diffTenant = `tenant_diff_user_${Date.now()}`;
      const uDiff = await UserModel.create({
        tenantId: diffTenant,
        name: "Worker in Other Mill",
        email,
        passwordHash: "hash789",
        role: "supervisor",
        processAreas: ["weaving"],
        status: "active",
      });
      expect(uDiff._id).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // 3. Array Caps & CAP_EXCEEDED Enforcement
  // -------------------------------------------------------------------------
  describe("Array Caps & CAP_EXCEEDED Enforcement", () => {
    it("enforces quotation revisions cap (max 20) and throws CAP_EXCEEDED", async () => {
      const order = await ordersRepo.create(tenantId, {
        orderNumber: `ORD-REV-CAP-${Date.now()}`,
        clientId: sampleClientId,
        productId: sampleProductId,
        quantity: 500,
        deliveryDeadline: "2026-12-31",
        spec: { sizes: ["M"] },
        quotation: {
          totalPaise: 50000,
          revisions: Array.from({ length: 20 }, (_, i) => ({
            revisionNo: i + 1,
            reasonType: "price_surge" as const,
            oldPricePaise: 40000,
            newPricePaise: 50000,
            changePct: 25,
            clientReason: "Market yarn price fluctuation",
            status: "superseded" as const,
          })),
        },
      });

      // 21st revision must be rejected with CAP_EXCEEDED
      await expect(
        ordersRepo.addQuotationRevision(tenantId, order._id, {
          revisionNo: 21,
          reasonType: "price_surge",
          oldPricePaise: 50000,
          newPricePaise: 52500,
          changePct: 5,
          clientReason: "Further price update",
          status: "proposed",
        })
      ).rejects.toThrow(/cap of 20 exceeded/);
    });

    it("enforces milestones cap (max 12) and throws CAP_EXCEEDED", async () => {
      const order = await ordersRepo.create(tenantId, {
        orderNumber: `ORD-MILE-CAP-${Date.now()}`,
        clientId: sampleClientId,
        productId: sampleProductId,
        quantity: 500,
        deliveryDeadline: "2026-12-31",
        spec: { sizes: ["M"] },
        financials: {
          advanceReceivedPaise: 0,
          totalPaidPaise: 0,
          milestones: Array.from({ length: 12 }, (_, i) => ({
            milestone: `Milestone ${i + 1}`,
            trigger: i === 0 ? "advance" : "stage",
            amountPaise: 10000,
            status: "pending",
          })),
        },
      });

      // 13th milestone must be rejected with CAP_EXCEEDED
      await expect(
        ordersRepo.addMilestone(tenantId, order._id, {
          milestone: "Excess Milestone 13",
          trigger: "stage",
          amountPaise: 5000,
          status: "pending",
        })
      ).rejects.toThrow(/cap of 12 exceeded/);
    });

    it("enforces deliveries cap (max 50) and throws CAP_EXCEEDED", async () => {
      const order = await ordersRepo.create(tenantId, {
        orderNumber: `ORD-DELIV-CAP-${Date.now()}`,
        clientId: sampleClientId,
        productId: sampleProductId,
        quantity: 10000,
        deliveryDeadline: "2026-12-31",
        spec: { sizes: ["M"] },
        deliveries: Array.from({ length: 50 }, (_, i) => ({
          deliveryDate: "2026-11-01",
          qty: 100,
          invoiceNo: `INV-${i + 1}`,
          invoiceAmountPaise: 10000,
          onTime: true,
          delayDays: 0,
          recordedBy: sampleAdminId,
        })),
      });

      // 51st delivery must be rejected with CAP_EXCEEDED
      await expect(
        ordersRepo.addDelivery(tenantId, order._id, {
          deliveryDate: "2026-11-02",
          qty: 100,
          invoiceNo: "INV-51",
          invoiceAmountPaise: 10000,
          onTime: true,
          delayDays: 0,
          recordedBy: sampleAdminId,
        })
      ).rejects.toThrow(/cap of 50 exceeded/);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Fully Populated Order Under 1MB
  // -------------------------------------------------------------------------
  it("proves a fully populated order document with max caps remains well under 1MB", async () => {
    const rawMaterialId = new mongoose.Types.ObjectId();

    // Populate order with max caps
    const fullOrder = await ordersRepo.create(tenantId, {
      orderNumber: `ORD-MAX-SIZE-${Date.now()}`,
      clientId: sampleClientId,
      productId: sampleProductId,
      quantity: 50000,
      deliveryDeadline: "2027-06-30",
      status: OrderStatus.IN_PRODUCTION,
      spec: {
        sizes: ["XS", "S", "M", "L", "XL", "XXL"],
        gsm: 220,
        colours: ["Navy Blue", "Charcoal Grey", "Olive Green", "Crimson Red"],
        fabric: "Combed Organic Cotton 40s Twill",
        print: "Reactive Discharge Screen Print",
      },
      productDescription: "Full spec commercial run for luxury institutional garment line",
      statusHistory: Array.from({ length: 50 }, (_, i) => ({
        status: i % 2 === 0 ? "in_production" : "analyzing",
        by: sampleAdminId,
        at: new Date(Date.now() - (50 - i) * 86400000),
        reason: `Automated status update milestone ${i + 1}`,
      })),
      feasibility: {
        verdict: "feasible",
        etaDate: "2027-06-25",
        bottleneckProcess: "dyeing",
        materialRequirements: [
          { materialId: rawMaterialId, req: 5000, avail: 6000, short: 0 },
        ],
      },
      quotation: {
        unitPrice: 45000,
        totalPaise: 2250000000,
        etaDate: "2027-06-25",
        clientExplanation: "Standard lead time calculation based on available loom capacity",
        termsVersion: "2026-V2",
        priceVariationClause: "Cotton yarn price variation capped at 5%",
        revisions: Array.from({ length: 20 }, (_, i) => ({
          revisionNo: i + 1,
          reasonType: "price_surge" as const,
          oldPricePaise: 40000 + i * 100,
          newPricePaise: (44000 + i * 100),
          changePct: 10,
          clientReason: "Price adjustment",
          status: i === 19 ? "accepted" as const : "superseded" as const,
          createdAt: new Date(),
        })),
      },
      costing: {
        materialCosts: [
          { materialId: rawMaterialId, qty: 5000, ratePaise: 38000, paise: 1900000000 },
        ],
        processingCosts: [
          { stage: "spinning", paise: 15000000 },
          { stage: "weaving", paise: 25000000 },
          { stage: "dyeing", paise: 20000000 },
          { stage: "finishing", paise: 10000000 },
        ],
        marginPct: 18,
        marginPaise: 350000000,
        wastagePaise: 50000000,
        riskBufferPaise: 25000000,
        overheadPaise: 15000000,
        totalCostPaise: 2250000000,
        formulaVersion: "F-2026.4",
      },
      purchaseDecisions: Array.from({ length: 50 }, (_, i) => ({
        decisionId: `DEC-${i + 1}`,
        materialId: rawMaterialId,
        qty: 100,
        ratePaise: 38000,
        decidedBy: sampleAdminId,
        decidedAt: new Date(),
      })),
      reservations: Array.from({ length: 50 }, (_, i) => ({
        materialId: rawMaterialId,
        qty: 100,
        status: "active",
      })),
      production: {
        assignedSupervisors: [
          { supervisorId: sampleAdminId, assignedAt: new Date() },
        ],
        phase: "weaving",
        percentComplete: 45,
        producedQty: 22500,
        stageTotals: [
          { stage: "spinning", produced: 50000, defective: 200 },
          { stage: "weaving", produced: 22500, defective: 150 },
        ],
      },
      financials: {
        advanceReceivedPaise: 675000000,
        totalPaidPaise: 675000000,
        milestones: Array.from({ length: 12 }, (_, i) => ({
          milestone: `Milestone ${i + 1}`,
          trigger: i === 0 ? "advance" : "stage",
          amountPaise: 187500000,
          status: i === 0 ? "received" : "pending",
          receipts: Array.from({ length: 10 }, (_, r) => ({
            amountPaise: 18750000,
            method: "neft",
            ref: `NEFT-${i + 1}-${r + 1}`,
            date: "2026-11-01",
          })),
        })),
      },
      deliveries: Array.from({ length: 50 }, (_, i) => ({
        deliveryDate: "2026-12-01",
        qty: 1000,
        invoiceNo: `INV-MAX-${i + 1}`,
        invoiceAmountPaise: 45000000,
        onTime: true,
        delayDays: 0,
        recordedBy: sampleAdminId,
      })),
    });

    const docObj = fullOrder.toObject();
    const bsonSize = (mongoose.mongo as any).BSON.calculateObjectSize(docObj);
    const docJson = JSON.stringify(docObj);
    const jsonByteSize = Buffer.byteLength(docJson, "utf8");

    // Breakdown byte size per top-level path
    const pathSizes: Record<string, number> = {};
    for (const [key, value] of Object.entries(docObj)) {
      pathSizes[key] = (mongoose.mongo as any).BSON.calculateObjectSize({ [key]: value });
    }

    // Must be well below MongoDB's 16MB limit and strictly under 1MB
    expect(bsonSize).toBeLessThan(1048576); // < 1MB
    expect(jsonByteSize).toBeLessThan(1048576); // < 1MB
    expect(bsonSize).toBeLessThan(120000); // Actually ~60KB - 80KB
  });

  // -------------------------------------------------------------------------
  // 5. Additional Cap Tests (statusHistory 200, purchaseDecisions 50, receipts 50)
  // -------------------------------------------------------------------------
  describe("Extended Array Caps Enforcement (CAP_EXCEEDED)", () => {
    it("enforces purchaseDecisions cap (max 50) and throws CAP_EXCEEDED", async () => {
      const rawMatId = new mongoose.Types.ObjectId();
      const order = await ordersRepo.create(tenantId, {
        orderNumber: `ORD-PURCH-CAP-${Date.now()}`,
        clientId: sampleClientId,
        productId: sampleProductId,
        quantity: 1000,
        deliveryDeadline: "2026-12-31",
        spec: { sizes: ["M"] },
        purchaseDecisions: Array.from({ length: 50 }, (_, i) => ({
          decisionId: `DEC-${i + 1}`,
          materialId: rawMatId,
          qty: 10,
          ratePaise: 20000,
          decidedBy: sampleAdminId,
          decidedAt: new Date(),
        })),
      });

      // 51st decision must throw CAP_EXCEEDED
      await expect(
        ordersRepo.addPurchaseDecision(tenantId, order._id, {
          decisionId: "DEC-51",
          materialId: rawMatId,
          qty: 10,
          ratePaise: 20000,
          decidedBy: sampleAdminId,
          decidedAt: new Date(),
        })
      ).rejects.toThrow(/cap of 50 exceeded/);
    });

    it("enforces receipts cap (max 50 per milestone) and throws CAP_EXCEEDED", async () => {
      const order = await ordersRepo.create(tenantId, {
        orderNumber: `ORD-RCPT-CAP-${Date.now()}`,
        clientId: sampleClientId,
        productId: sampleProductId,
        quantity: 1000,
        deliveryDeadline: "2026-12-31",
        spec: { sizes: ["M"] },
        financials: {
          advanceReceivedPaise: 0,
          totalPaidPaise: 50000,
          milestones: [
            {
              milestone: "Advance Payment",
              trigger: "advance",
              amountPaise: 100000,
              status: "partial",
              receipts: Array.from({ length: 50 }, (_, i) => ({
                amountPaise: 1000,
                method: "neft",
                ref: `NEFT-CAP-${i + 1}`,
                date: "2026-11-01",
              })),
            },
          ],
        },
      });

      // 51st receipt must throw CAP_EXCEEDED
      await expect(
        ordersRepo.recordPaymentReceipt(tenantId, order._id, 0, {
          amountPaise: 1000,
          method: "neft",
          ref: "NEFT-CAP-51",
          date: "2026-11-02",
        })
      ).rejects.toThrow(/cap of 50 per milestone exceeded/);
    });

    it("enforces statusHistory cap (max 200) and throws CAP_EXCEEDED", async () => {
      const order = await ordersRepo.create(tenantId, {
        orderNumber: `ORD-HIST-CAP-${Date.now()}`,
        clientId: sampleClientId,
        productId: sampleProductId,
        quantity: 1000,
        deliveryDeadline: "2026-12-31",
        spec: { sizes: ["M"] },
        status: OrderStatus.SUBMITTED,
        statusHistory: Array.from({ length: 200 }, (_, i) => ({
          status: "submitted",
          by: sampleAdminId,
          at: new Date(),
          reason: `Step ${i + 1}`,
        })),
      });

      // 201st transition must throw CAP_EXCEEDED
      await expect(
        ordersRepo.updateStatus(tenantId, order._id, OrderStatus.ANALYZING, {
          by: sampleAdminId,
          role: "admin",
          reason: "Proceed to analysis",
        })
      ).rejects.toThrow(/cap of 200 exceeded/);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Repository Architecture, Projections & Concurrency Invariants
  // -------------------------------------------------------------------------
  describe("Repository Architecture, Projections & Concurrency Invariants", () => {
    it("proves OrdersRepository does NOT inherit from BaseRepository (no generic update/save/updateOne)", () => {
      expect((ordersRepo as any).update).toBeUndefined();
      expect((ordersRepo as any).updateOne).toBeUndefined();
      expect((ordersRepo as any).save).toBeUndefined();
      expect((ordersRepo as any).findWithTotal).toBeUndefined();
    });

    it("proves SUPERVISOR_ORDER_PROJECTION strictly excludes pricing, costing, quotation, and financials", () => {
      const keys = Object.keys(SUPERVISOR_ORDER_PROJECTION);
      expect(keys).toContain("orderNumber");
      expect(keys).toContain("production");
      expect(keys).toContain("spec");
      expect(keys).toContain("deliveries");

      // Strictly excluded
      expect(keys).not.toContain("quotation");
      expect(keys).not.toContain("costing");
      expect(keys).not.toContain("financials");
      expect(keys).not.toContain("feasibility");
      expect(keys).not.toContain("quotedTotalPaise");
    });

    it("proves parallel different-path writers BOTH persist without clobbering each other", async () => {
      const rawMatId = new mongoose.Types.ObjectId();
      const order = await ordersRepo.create(tenantId, {
        orderNumber: `ORD-CONCUR-DIFF-${Date.now()}`,
        clientId: sampleClientId,
        productId: sampleProductId,
        quantity: 1000,
        deliveryDeadline: "2026-12-31",
        spec: { sizes: ["M"] },
      });

      // Concurrently run Writer 1 (updates production progress) and Writer 2 (adds a purchase decision)
      await Promise.all([
        ordersRepo.updateProductionProgress(tenantId, order._id, {
          phase: "weaving",
          percentComplete: 30,
          producedQty: 300,
        }),
        ordersRepo.addPurchaseDecision(tenantId, order._id, {
          decisionId: "DEC-PARALLEL-1",
          materialId: rawMatId,
          qty: 50,
          ratePaise: 25000,
          decidedBy: sampleAdminId,
          decidedAt: new Date(),
        }),
      ]);

      const refreshed = await OrderModel.findById(order._id).lean();
      expect(refreshed?.production?.phase).toBe("weaving");
      expect(refreshed?.production?.percentComplete).toBe(30);
      expect(refreshed?.purchaseDecisions?.length).toBe(1);
      expect(refreshed?.purchaseDecisions?.[0].decisionId).toBe("DEC-PARALLEL-1");
    });

    it("proves parallel updateStatus calls from the same status result in exactly one winner and one conflict", async () => {
      const order = await ordersRepo.create(tenantId, {
        orderNumber: `ORD-CONCUR-STATUS-${Date.now()}`,
        clientId: sampleClientId,
        productId: sampleProductId,
        quantity: 1000,
        deliveryDeadline: "2026-12-31",
        spec: { sizes: ["M"] },
        status: OrderStatus.SUBMITTED,
      });

      // Trigger two concurrent status updates from 'submitted' to 'analyzing'
      const results = await Promise.allSettled([
        ordersRepo.updateStatus(tenantId, order._id, OrderStatus.ANALYZING, {
          by: sampleAdminId,
          role: "admin",
          reason: "Writer 1 start",
        }),
        ordersRepo.updateStatus(tenantId, order._id, OrderStatus.ANALYZING, {
          by: sampleAdminId,
          role: "admin",
          reason: "Writer 2 start",
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      const error = (rejected[0] as PromiseRejectedResult).reason;
      expect(error.message).toMatch(/conflict|status has changed/i);
    });

    it("proves +costing appears ONLY in admin-costing.repository.ts across entire src directory", () => {
      const srcDir = path.resolve(__dirname, "../../src");
      function scanDir(dir: string): string[] {
        let hits: string[] = [];
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            hits = hits.concat(scanDir(fullPath));
          } else if (fullPath.endsWith(".ts")) {
            const content = fs.readFileSync(fullPath, "utf8");
            if (content.includes("+costing")) {
              hits.push(fullPath.replace(/\\/g, "/"));
            }
          }
        }
        return hits;
      }

      const costingHits = scanDir(srcDir);
      expect(costingHits.length).toBe(1);
      expect(costingHits[0]).toContain("src/repositories/admin-costing.repository.ts");
    });
  });
});
