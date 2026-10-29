import { describe, it, beforeAll, afterAll, beforeEach, expect } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../src/app.js";
import { setupTestDB, teardownTestDB, clearTestDB } from "./setup.js";
import {
  authService,
  materialRepository,
  customerRepository,
  supplierRepository,
  processRepository,
  orderRepository,
  quotationRepository,
  enquiryRepository,
  workforceRepository,
  unitOfWork,
} from "../src/container.js";
import { UserRole, MaterialType, ProcessName, OrderStatus, QuotationStatus } from "@loompilot/shared";

describe("Stage 2B - Step 3: Master Data, Foundations, and Bulk Imports", () => {
  const tenantId = "tenant_master_step3";
  let ownerToken: string;
  let managerToken: string;
  let storeToken: string;
  let salesToken: string;

  beforeAll(async () => {
    await setupTestDB();
  }, 60000);

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    // Setup Owner (first user of tenant)
    const owner = await authService.register({
      tenantId,
      email: "owner@step3.test",
      password: "Password123!",
      name: "Owner Step3",
      role: UserRole.OWNER,
    });

    const ownerActor = { tenantId, userId: owner.id, role: UserRole.OWNER, email: owner.email };

    // Setup Manager
    const manager = await authService.register(
      {
        tenantId,
        email: "manager@step3.test",
        password: "Password123!",
        name: "Manager Step3",
        role: UserRole.MANAGER,
      },
      ownerActor
    );

    // Setup Store
    const store = await authService.register(
      {
        tenantId,
        email: "store@step3.test",
        password: "Password123!",
        name: "Store Step3",
        role: UserRole.STORE,
      },
      ownerActor
    );

    // Setup Sales
    const sales = await authService.register(
      {
        tenantId,
        email: "sales@step3.test",
        password: "Password123!",
        name: "Sales Step3",
        role: UserRole.SALES,
      },
      ownerActor
    );

    const ownerLogin = await authService.login({
      tenantId,
      email: "owner@step3.test",
      password: "Password123!",
    });
    ownerToken = ownerLogin.accessToken;

    const managerLogin = await authService.login({
      tenantId,
      email: "manager@step3.test",
      password: "Password123!",
    });
    managerToken = managerLogin.accessToken;

    const storeLogin = await authService.login({
      tenantId,
      email: "store@step3.test",
      password: "Password123!",
    });
    storeToken = storeLogin.accessToken;

    const salesLogin = await authService.login({
      tenantId,
      email: "sales@step3.test",
      password: "Password123!",
    });
    salesToken = salesLogin.accessToken;
  });

  // 1. Settings & Holidays (3.a & 3.b)
  describe("3.a & 3.b: Settings and Holidays", () => {
    it("reads default tenant settings and updates them (owner only)", async () => {
      // Non-owner gets 403 on PATCH
      const forbiddenRes = await request(app)
        .patch("/api/v1/settings")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ companyName: "Hacked Name" });
      expect(forbiddenRes.status).toBe(403);

      // Owner updates settings
      const patchRes = await request(app)
        .patch("/api/v1/settings")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          companyName: "LoomPilot Silk Mills",
          workingHoursPerDay: 9,
          defaultPaymentTermsDays: 45,
          defaultWastagePct: 6.5,
        });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.companyName).toBe("LoomPilot Silk Mills");
      expect(patchRes.body.data.workingHoursPerDay).toBe(9);

      // Read back
      const getRes = await request(app)
        .get("/api/v1/settings")
        .set("Authorization", `Bearer ${managerToken}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.companyName).toBe("LoomPilot Silk Mills");
      expect(getRes.body.data.defaultWastagePct).toBe(6.5);
    });

    it("creates, lists, and deletes tenant holidays", async () => {
      const createRes = await request(app)
        .post("/api/v1/settings/holidays")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          date: "2026-11-01",
          name: "Diwali Special",
          isOptional: false,
        });
      expect(createRes.status).toBe(201);
      const holidayId = createRes.body.data.id;

      const listRes = await request(app)
        .get("/api/v1/settings/holidays?year=2026")
        .set("Authorization", `Bearer ${managerToken}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBeGreaterThan(0);
      expect(listRes.body.data.some((h: any) => h.name === "Diwali Special")).toBe(true);

      const delRes = await request(app)
        .delete(`/api/v1/settings/holidays/${holidayId}`)
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(delRes.status).toBe(200);
      expect(delRes.body.data.deleted).toBe(true);
    });
  });

  // 2. Products & BOM Versioning (3.c)
  describe("3.c: Products and Immutable BOM", () => {
    it("creates product and publishes versioned immutable BOMs", async () => {
      const prodRes = await request(app)
        .post("/api/v1/products")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({
          code: "PROD-SILK-SAREE-01",
          name: "Kanchipuram Silk Saree 6yd",
          category: "Saree",
          unit: "pieces",
          hsnCode: "500720",
        });
      expect(prodRes.status).toBe(201);
      const productId = prodRes.body.data.id;

      // Create Material for BOM
      const mat = await materialRepository.create({
        tenantId,
        code: "RAW-SILK-20D",
        name: "Pure Mulberry Raw Silk 20D",
        type: MaterialType.YARN,
        unit: "kg",
        currentRatePaise: 450000,
        avgCostPaise: 450000,
      });

      // Create Process for BOM
      const proc = await processRepository.create({
        tenantId,
        name: ProcessName.WEAVING,
        sequence: 1,
        standardWastagePct: 3,
        avgOutputPerWorkerHour: 2,
        unit: "meters",
        costPerUnitPaise: 5000,
      });

      // 1. First BOM (v1)
      const bom1Res = await request(app)
        .post(`/api/v1/products/${productId}/bom`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({
          effectiveDate: "2026-10-01",
          materials: [{ materialId: mat.id, quantity: 0.8, unit: "kg", wastagePercent: 2 }],
          processes: [{ processId: proc.id, sequence: 1, estimatedHoursPerUnit: 4 }],
          notes: "Initial launch BOM",
        });
      expect(bom1Res.status).toBe(201);
      expect(bom1Res.body.data.version).toBe(1);

      // 2. Second BOM (v2) - auto-increments version
      const bom2Res = await request(app)
        .post(`/api/v1/products/${productId}/bom`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({
          effectiveDate: "2026-10-15",
          materials: [{ materialId: mat.id, quantity: 0.75, unit: "kg", wastagePercent: 1.5 }],
          processes: [{ processId: proc.id, sequence: 1, estimatedHoursPerUnit: 3.5 }],
          notes: "Optimized yarn consumption",
        });
      expect(bom2Res.status).toBe(201);
      expect(bom2Res.body.data.version).toBe(2);

      // 3. Active BOM is latest version (v2)
      const activeBom = await request(app)
        .get(`/api/v1/products/${productId}/bom`)
        .set("Authorization", `Bearer ${managerToken}`);
      expect(activeBom.status).toBe(200);
      expect(activeBom.body.data.version).toBe(2);

      // 4. List all versions
      const versionsRes = await request(app)
        .get(`/api/v1/products/${productId}/bom/versions`)
        .set("Authorization", `Bearer ${managerToken}`);
      expect(versionsRes.status).toBe(200);
      expect(versionsRes.body.data.length).toBe(2);
    });
  });

  // 3. Material Stock Operations & Weighted-Average Cost (3.e & 3.f)
  describe("3.e & 3.f: Material Ledger, Goods Receipt, and Weighted Average Cost", () => {
    it("updates rate, computes weighted-average cost on goods receipt, and tracks stock summary", async () => {
      const mat = await materialRepository.create({
        tenantId,
        code: "COTTON-COMBED-60S",
        name: "Combed Cotton 60s Yarn",
        type: MaterialType.YARN,
        unit: "kg",
        currentRatePaise: 30000, // 300 INR/kg
        avgCostPaise: 30000,
        onHandQuantity: 100, // 100 kg @ ₹300 = ₹30,000 (3,000,000 paise)
        reservedQuantity: 20,
      });

      // 1. Update Market Rate
      const rateRes = await request(app)
        .post(`/api/v1/materials/${mat.id}/rate`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({
          ratePaise: 32000, // New market rate 320 INR/kg
          source: "market_update",
        });
      expect(rateRes.status).toBe(200);
      expect(rateRes.body.data.currentRatePaise).toBe(32000);

      // 2. Goods Receipt: Receive 100 kg @ ₹340 (34000 paise)
      // New WAC = ((100 * 30000) + (100 * 34000)) / (100 + 100) = 32000 paise
      const receiptRes = await request(app)
        .post(`/api/v1/materials/${mat.id}/receipt`)
        .set("Authorization", `Bearer ${storeToken}`)
        .send({
          receivedQty: 100,
          receivedCostPaise: 34000,
          referenceId: "GRN-00101",
          notes: "Batch from Supreme Yarns",
        });
      expect(receiptRes.status).toBe(201);
      expect(receiptRes.body.data.material.onHandQuantity).toBe(200);
      expect(receiptRes.body.data.material.avgCostPaise).toBe(32000);

      // 3. Stock Adjustment
      const adjustRes = await request(app)
        .post(`/api/v1/materials/${mat.id}/adjust`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({
          newOnHandQuantity: 195,
          reason: "Damaged packaging in transit",
        });
      expect(adjustRes.status).toBe(200);
      expect(adjustRes.body.data.material.onHandQuantity).toBe(195);

      // 4. Stock Summary
      const summaryRes = await request(app)
        .get("/api/v1/materials/stock-summary")
        .set("Authorization", `Bearer ${managerToken}`);
      expect(summaryRes.status).toBe(200);
      const summaryItem = summaryRes.body.data.find((s: any) => s.code === "COTTON-COMBED-60S");
      expect(summaryItem).toBeDefined();
      expect(summaryItem.onHandQuantity).toBe(195);
      expect(summaryItem.reservedQuantity).toBe(20);
      expect(summaryItem.availableQuantity).toBe(175);
    });
  });

  // 4. Workforce, Daily Output & Labour Cost Snapshot (3.h)
  describe("3.h: Workforce Updates, Idempotent Daily Output, and Labour Cost", () => {
    it("updates worker and enforces idempotent daily output and PATCH with reason", async () => {
      // 1. Create worker
      const workerRes = await request(app)
        .post("/api/v1/workforce/workers")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({
          workerCode: "W-101",
          name: "Ramesh Kumar",
          skillLevel: "skilled",
          hourlyRatePaise: 15000, // ₹150/hr
        });
      expect(workerRes.status).toBe(201);
      const workerId = workerRes.body.data.id;

      // 2. Patch worker
      const patchWorkerRes = await request(app)
        .patch(`/api/v1/workforce/workers/${workerId}`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ hourlyRatePaise: 16000 });
      expect(patchWorkerRes.status).toBe(200);
      expect(patchWorkerRes.body.data.hourlyRatePaise).toBe(16000);

      // Setup dummy order and process
      const orderId = new mongoose.Types.ObjectId().toString();
      const processId = new mongoose.Types.ObjectId().toString();

      // 3. Record daily output with entries snapshot (8 hours * 16000 = 128000 paise labour cost)
      const dailyPayload = {
        orderId,
        processId,
        date: "2026-11-10",
        idempotencyKey: "idem_daily_step3_001",
        entries: [
          {
            workerId,
            hoursWorked: 8,
            quantityProduced: 250,
            quantityDefective: 2,
            hourlyRatePaiseSnapshot: 16000,
          },
        ],
      };

      const outputRes1 = await request(app)
        .post("/api/v1/workforce/daily-outputs")
        .set("Authorization", `Bearer ${managerToken}`)
        .send(dailyPayload);
      expect(outputRes1.status).toBe(201);
      expect(outputRes1.body.data.labourCostPaise).toBe(128000);
      expect(outputRes1.body.data.quantityProduced).toBe(250);
      const outputId = outputRes1.body.data.id;

      // 4. Same payload again is idempotent replay (returns 201 with same ID)
      const outputResDuplicate = await request(app)
        .post("/api/v1/workforce/daily-outputs")
        .set("Authorization", `Bearer ${managerToken}`)
        .send(dailyPayload);
      expect(outputResDuplicate.status).toBe(201);
      expect(outputResDuplicate.body.data.id).toBe(outputId);

      // 5. Different payload for same day throws 409 OUTPUT_ALREADY_RECORDED
      const outputResConflict = await request(app)
        .post("/api/v1/workforce/daily-outputs")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({
          orderId,
          processId,
          date: "2026-11-10",
          idempotencyKey: "idem_daily_step3_002",
          quantityProduced: 400, // Conflict with 250!
        });
      expect(outputResConflict.status).toBe(409);
      expect(outputResConflict.body.error.code).toBe("OUTPUT_ALREADY_RECORDED");

      // 6. Must use explicit PATCH with reason to update
      const patchOutputRes = await request(app)
        .patch(`/api/v1/workforce/daily-outputs/${outputId}`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({
          quantityProduced: 400,
          reason: "Supervisor recount after shift end",
        });
      expect(patchOutputRes.status).toBe(200);
      expect(patchOutputRes.body.data.quantityProduced).toBe(400);
    });
  });

  // 5. Order Material Issue & Actual Cost Route (3.f & 3.h)
  describe("3.f & 3.h: Material Issue to Floor and Order Cost Reporting", () => {
    it("issues materials to order and reports real-time costs and variance", async () => {
      // 1. Create Material
      const mat = await materialRepository.create({
        tenantId,
        code: "RAW-YARN-80S",
        name: "Cotton Yarn 80s",
        type: MaterialType.YARN,
        unit: "kg",
        currentRatePaise: 40000, // ₹400/kg
        avgCostPaise: 40000,
        onHandQuantity: 500,
        reservedQuantity: 100,
      });

      // 2. Create Process
      const proc = await processRepository.create({
        tenantId,
        name: ProcessName.SPINNING,
        sequence: 1,
        costPerUnitPaise: 250, // ₹2.50 per unit
      });

      // 3. Create Quotation
      const dummyEnquiryId = new mongoose.Types.ObjectId().toString();
      const dummyCustomerId = new mongoose.Types.ObjectId().toString();

      const quotation = await quotationRepository.create({
        tenantId,
        enquiryId: dummyEnquiryId,
        customerId: dummyCustomerId,
        quotationNumber: "QT-2026-0001",
        lineItems: [],
        materialCostPaise: 2000000, // Quoted Material: ₹20,000
        processingCostPaise: 500000, // Quoted Labour/Processing: ₹5,000
        overheadCostPaise: 100000,
        wastagePct: 5,
        wastageCostPaise: 100000,
        riskBufferPct: 3,
        riskBufferCostPaise: 60000,
        subtotalCostPaise: 2760000, // Quoted Total: ₹27,600
        marginPct: 15,
        profitPaise: 414000,
        finalPricePaise: 3174000,
        etaDate: "2026-12-01",
        validUntil: "2026-11-20",
        status: QuotationStatus.APPROVED,
        explanation: "Test Quotation",
        assumptions: [],
        inputsSnapshot: {},
      });

      // 4. Create Order linked to Quotation
      const order = await orderRepository.create({
        tenantId,
        quotationId: quotation.id,
        customerId: dummyCustomerId,
        orderNumber: "PO-ORD-0001",
        productName: "Cotton Yarn 80s 1000m",
        totalQuantity: 1000,
        unit: "meters",
        status: OrderStatus.IN_PROGRESS,
        startDate: "2026-11-01",
        targetDeliveryDate: "2026-11-20",
        plan: [],
      });

      // 5. Issue Materials to Order (50 kg @ 40000 paise = 2,000,000 paise = ₹20,000)
      const issueRes = await request(app)
        .post(`/api/v1/orders/${order.id}/issue-materials`)
        .set("Authorization", `Bearer ${storeToken}`)
        .send({
          items: [{ materialId: mat.id, quantity: 50 }],
          notes: "Initial yarn issue for weaving",
        });
      expect(issueRes.status).toBe(200);
      expect(issueRes.body.data.totalMaterialCostPaise).toBe(2000000);
      expect(issueRes.body.data.currentOrderMaterialCostPaise).toBe(2000000);

      // Verify material stock onHand and reserved deducted
      const updatedMat = await materialRepository.findById(tenantId, mat.id);
      expect(updatedMat?.onHandQuantity).toBe(450);
      expect(updatedMat?.reservedQuantity).toBe(50); // 100 - 50 = 50

      // 6. Record Daily Output for this order (produces actual labour cost and process cost)
      await workforceRepository.upsertDailyOutput({
        tenantId,
        orderId: order.id,
        processId: proc.id,
        date: "2026-11-05",
        labourCostPaise: 480000, // ₹4,800
        quantityProduced: 800, // 800 units * 250 paise = 200,000 paise
        idempotencyKey: `daily_${order.id}_${proc.id}_2026-11-05`,
      });

      // 7. Get Order Costs
      // Store role gets 403 (store cannot read cost or margin)
      const storeRes = await request(app)
        .get(`/api/v1/orders/${order.id}/costs`)
        .set("Authorization", `Bearer ${storeToken}`);
      expect(storeRes.status).toBe(403);

      // Manager gets complete breakdown
      const costRes = await request(app)
        .get(`/api/v1/orders/${order.id}/costs`)
        .set("Authorization", `Bearer ${managerToken}`);
      expect(costRes.status).toBe(200);
      const data = costRes.body.data;
      expect(data.actualMaterialCostPaise).toBe(2000000);
      expect(data.actualLabourCostPaise).toBe(480000);
      expect(data.actualProcessCostPaise).toBe(200000); // 800 * 250
      expect(data.totalActualCostPaise).toBe(2680000); // 2000000 + 480000 + 200000
      expect(data.quotedTotalCostPaise).toBe(2760000);
      expect(data.variancePaise).toBe(2680000 - 2760000); // -80,000 paise (under budget)
    });
  });

  // 6. Supplier Orders & Purchasing Lifecycle (3.g)
  describe("3.g: Supplier Orders & Purchasing Lifecycle", () => {
    it("creates draft PO, places it, and receives goods updating material stock", async () => {
      // 1. Create Supplier and Material
      const supplier = await supplierRepository.create({
        tenantId,
        name: "Vardhman Textiles Ltd",
        code: "SUP-VARD-01",
        contactPerson: "Anil Jain",
        email: "anil@vardhman.com",
        phone: "+919876543299",
      });

      const material = await materialRepository.create({
        tenantId,
        code: "POLY-VISCOSE-30S",
        name: "Polyester Viscose 30s",
        type: MaterialType.YARN,
        unit: "kg",
        currentRatePaise: 25000,
        avgCostPaise: 25000,
        onHandQuantity: 50,
      });

      // 2. Create Draft PO
      const createPoRes = await request(app)
        .post("/api/v1/supplier-orders")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({
          supplierId: supplier.id,
          expectedDeliveryDate: "2026-11-25",
          items: [
            {
              materialId: material.id,
              quantity: 100,
              unitCostPaise: 26000, // ₹260/kg
            },
          ],
          notes: "Rush order for winter season",
        });
      expect(createPoRes.status).toBe(201);
      expect(createPoRes.body.data.status).toBe("draft");
      expect(createPoRes.body.data.orderNumber).toMatch(/^PO-\d{5}$/);
      const poId = createPoRes.body.data.id;

      // 3. Place Order
      const placeRes = await request(app)
        .patch(`/api/v1/supplier-orders/${poId}`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ status: "placed" });
      expect(placeRes.status).toBe(200);
      expect(placeRes.body.data.status).toBe("placed");
      expect(placeRes.body.data.placedAt).toBeDefined();

      // 4. Receive Partial Shipment (60 kg)
      const receive1Res = await request(app)
        .post(`/api/v1/supplier-orders/${poId}/receive`)
        .set("Authorization", `Bearer ${storeToken}`)
        .send({
          items: [{ materialId: material.id, quantity: 60, unitCostPaise: 26000 }],
          notes: "First truck delivery 60kg",
        });
      expect(receive1Res.status).toBe(200);
      expect(receive1Res.body.data.status).toBe("partially_received");
      expect(receive1Res.body.data.items[0].receivedQty).toBe(60);

      // Verify Material Stock updated
      const matAfterRec1 = await materialRepository.findById(tenantId, material.id);
      expect(matAfterRec1?.onHandQuantity).toBe(110); // 50 + 60

      // 5. Receive Remaining Shipment (40 kg)
      const receive2Res = await request(app)
        .post(`/api/v1/supplier-orders/${poId}/receive`)
        .set("Authorization", `Bearer ${storeToken}`)
        .send({
          items: [{ materialId: material.id, quantity: 40 }],
          notes: "Final shipment received",
        });
      expect(receive2Res.status).toBe(200);
      expect(receive2Res.body.data.status).toBe("received");
      expect(receive2Res.body.data.items[0].receivedQty).toBe(100);

      const matAfterRec2 = await materialRepository.findById(tenantId, material.id);
      expect(matAfterRec2?.onHandQuantity).toBe(150); // 110 + 40
    });
  });

  // 7. Enquiry Enhancements & Immutability (3.i)
  describe("3.i: Enquiry Enhancements and Specs Protection", () => {
    it("updates enquiry specs while status is new, rejects updates once quoted", async () => {
      const cust = await customerRepository.create({
        tenantId,
        name: "Raymond Apparel",
        code: "CUST-RAY-01",
        contactPerson: "Gautam Singhania",
        email: "gautam@raymond.com",
        phone: "+919876543200",
      });

      const enq = await enquiryRepository.create({
        tenantId,
        customerId: cust.id,
        customerName: cust.name,
        rawText: "Need 5000m suiting fabric in navy blue",
        specs: {
          width: "58 inches",
          gsm: 240,
          weaveType: "Twill",
        },
        status: "new",
      });

      // 1. Update while status === "new"
      const updateRes = await request(app)
        .patch(`/api/v1/enquiries/${enq.id}`)
        .set("Authorization", `Bearer ${salesToken}`)
        .send({
          specs: {
            width: "60 inches",
            gsm: 250,
            weaveType: "Herringbone Twill",
            colorOrPantone: "Pantone 19-4029 Classic Navy",
          },
        });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.specs.weaveType).toBe("Herringbone Twill");
      expect(updateRes.body.data.specs.gsm).toBe(250);

      // 2. Transition status to "quoted"
      await enquiryRepository.updateStatus(tenantId, enq.id, "quoted");

      // 3. Attempt update now -> Rejected 400
      const rejectedRes = await request(app)
        .patch(`/api/v1/enquiries/${enq.id}`)
        .set("Authorization", `Bearer ${salesToken}`)
        .send({
          rawText: "Silently changing enquiry terms",
        });
      expect(rejectedRes.status).toBe(400);
      expect(rejectedRes.body.error.message).toContain("Only enquiries in 'new' status can be modified");
    });
  });

  // 8. Bulk Imports (3.j)
  describe("3.j: CSV Bulk Imports and Templates", () => {
    it("downloads CSV templates for all entity types", async () => {
      for (const type of ["customers", "suppliers", "materials"]) {
        const res = await request(app)
          .get(`/api/v1/imports/templates/${type}`)
          .set("Authorization", `Bearer ${managerToken}`);
        expect(res.status).toBe(200);
        expect(res.headers["content-type"]).toContain("text/csv");
        expect(res.text).toContain("\n");
      }
    });

    it("runs dry-run preview and commits valid materials skipping existing codes", async () => {
      const csvData = [
        "code,name,type,unit,currentRatePaise,avgCostPaise,reorderLevel",
        '"IMP-YARN-01","Bulk Cotton 30s","yarn","kg",25000,25000,100',
        '"IMP-YARN-02","Bulk Silk Yarn","yarn","kg",450000,450000,50',
      ].join("\n");

      // 1. Dry run
      const dryRunRes = await request(app)
        .post("/api/v1/imports/materials")
        .set("Authorization", `Bearer ${managerToken}`)
        .set("Content-Type", "text/csv")
        .send(csvData);
      expect(dryRunRes.status).toBe(200);
      expect(dryRunRes.body.data.totalRows).toBe(2);
      expect(dryRunRes.body.data.validRows).toBe(2);
      expect(dryRunRes.body.data.invalidRows).toBe(0);
      expect(dryRunRes.body.data.preview.length).toBe(2);

      // Verify materials not inserted yet
      const checkDryRun = await materialRepository.findByCode(tenantId, "IMP-YARN-01");
      expect(checkDryRun).toBeNull();

      // 2. Commit
      const commitRes = await request(app)
        .post("/api/v1/imports/materials?commit=true")
        .set("Authorization", `Bearer ${managerToken}`)
        .set("Content-Type", "text/csv")
        .send(csvData);
      expect(commitRes.status).toBe(200);
      expect(commitRes.body.data.insertedCount).toBe(2);
      expect(commitRes.body.data.skippedCount).toBe(0);

      // Verify materials inserted
      const checkCommit = await materialRepository.findByCode(tenantId, "IMP-YARN-01");
      expect(checkCommit).toBeDefined();
      expect(checkCommit?.currentRatePaise).toBe(25000);

      // 3. Re-committing same CSV skips duplicates
      const dupCommitRes = await request(app)
        .post("/api/v1/imports/materials?commit=true")
        .set("Authorization", `Bearer ${managerToken}`)
        .set("Content-Type", "text/csv")
        .send(csvData);
      expect(dupCommitRes.status).toBe(200);
      expect(dupCommitRes.body.data.insertedCount).toBe(0);
      expect(dupCommitRes.body.data.skippedCount).toBe(2);
    });

    it("returns 422 on commit when CSV has invalid rows", async () => {
      const invalidCsv = [
        "code,name,type,unit,currentRatePaise",
        '"BAD-MAT","Missing Unit And Type","invalid_type",,not_a_number',
      ].join("\n");

      const res = await request(app)
        .post("/api/v1/imports/materials?commit=true")
        .set("Authorization", `Bearer ${managerToken}`)
        .set("Content-Type", "text/csv")
        .send(invalidCsv);

      expect(res.status).toBe(422);
      expect(res.body.error.details.invalidRows).toBe(1);
      expect(res.body.error.details.errors.length).toBeGreaterThan(0);
    });
  });
});
