import { describe, it, beforeAll, afterAll, beforeEach, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { setupTestDB, teardownTestDB, clearTestDB } from "./setup.js";
import { authService } from "../src/container.js";
import { MaterialModel } from "../src/modules/materials/model.js";
import { QuotationModel } from "../src/modules/quotations/model.js";
import { PaymentModel } from "../src/modules/payments/model.js";
import { UserRole, QuotationStatus, NotificationChannel, ReminderStatus, PaymentStatus } from "@loompilot/shared";
import mongoose from "mongoose";

describe("Stage 2: Auth & Role-Permission Matrix Tests", () => {
  const tenantId = "tenant_test_1";
  let ownerToken: string;
  let storeToken: string;
  let accountsToken: string;
  let salesToken: string;

  beforeAll(async () => {
    await setupTestDB();
  }, 60000);

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    // Create users for each role
    await authService.register({
      tenantId,
      email: "owner@loompilot.test",
      password: "password123",
      name: "Owner User",
      role: UserRole.OWNER,
    });
    const ownerAuth = await authService.login({ tenantId, email: "owner@loompilot.test", password: "password123" });
    ownerToken = ownerAuth.accessToken;

    await authService.register({
      tenantId,
      email: "store@loompilot.test",
      password: "password123",
      name: "Store Clerk",
      role: UserRole.STORE,
    });
    const storeAuth = await authService.login({ tenantId, email: "store@loompilot.test", password: "password123" });
    storeToken = storeAuth.accessToken;

    await authService.register({
      tenantId,
      email: "accounts@loompilot.test",
      password: "password123",
      name: "Accounts Officer",
      role: UserRole.ACCOUNTS,
    });
    const accountsAuth = await authService.login({ tenantId, email: "accounts@loompilot.test", password: "password123" });
    accountsToken = accountsAuth.accessToken;

    await authService.register({
      tenantId,
      email: "sales@loompilot.test",
      password: "password123",
      name: "Sales Rep",
      role: UserRole.SALES,
    });
    const salesAuth = await authService.login({ tenantId, email: "sales@loompilot.test", password: "password123" });
    salesToken = salesAuth.accessToken;
  });

  it("authenticates user and returns JWT + sets httpOnly refresh token cookie", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        tenantId,
        email: "owner@loompilot.test",
        password: "password123",
      });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.email).toBe("owner@loompilot.test");
    expect(res.body.data.user.role).toBe(UserRole.OWNER);

    // Verify httpOnly cookie
    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toContain("loompilot_refresh_token=");
    expect(cookies[0]).toContain("HttpOnly");
  });

  it("rejects unauthenticated requests to protected routes with 401", async () => {
    const res = await request(app).get("/api/materials");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Unauthorized");
  });

  it("Rule 1: Store role cannot read cost or margin fields on materials", async () => {
    // Create test material with cost data
    const material = await MaterialModel.create({
      tenantId,
      code: "YARN-COT-30",
      name: "Cotton Yarn 30s",
      type: "yarn",
      unit: "kg",
      currentRatePaise: 25000, // Rs 250/kg
      avgCostPaise: 24000,
      onHandQuantity: 500,
    });

    // 1. Owner query: sees cost fields
    const ownerRes = await request(app)
      .get(`/api/materials/${material._id}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(ownerRes.status).toBe(200);
    expect(ownerRes.body.data.currentRatePaise).toBe(25000);
    expect(ownerRes.body.data.avgCostPaise).toBe(24000);

    // 2. Store query: cost fields MUST be stripped
    const storeRes = await request(app)
      .get(`/api/materials/${material._id}`)
      .set("Authorization", `Bearer ${storeToken}`);

    expect(storeRes.status).toBe(200);
    expect(storeRes.body.data.name).toBe("Cotton Yarn 30s");
    expect(storeRes.body.data.onHandQuantity).toBe(500);
    expect(storeRes.body.data.currentRatePaise).toBeUndefined();
    expect(storeRes.body.data.avgCostPaise).toBeUndefined();
  });

  it("Rule 1: Store role cannot read cost or margin fields on quotations", async () => {
    const quotation = await QuotationModel.create({
      tenantId,
      enquiryId: new mongoose.Types.ObjectId(),
      customerId: new mongoose.Types.ObjectId(),
      quotationNumber: "QT-TEST-001",
      lineItems: [
        {
          materialId: new mongoose.Types.ObjectId(),
          materialName: "Grey Fabric 40s",
          requiredQty: 1000,
          unit: "meters",
          onHandQty: 200,
          reservedQty: 0,
          toPurchaseQty: 800,
          unitCostPaise: 8500,
          totalCostPaise: 8500000,
          supplierLeadDays: 7,
        },
      ],
      materialCostPaise: 8500000,
      subtotalCostPaise: 8500000,
      wastagePct: 3.0,
      wastageCostPaise: 255000,
      riskBufferPct: 4.5,
      riskBufferCostPaise: 382500,
      marginPct: 15.0,
      profitPaise: 1370625,
      finalPricePaise: 10508125,
      etaDate: "2026-11-15",
      validUntil: "2026-11-05",
      status: QuotationStatus.DRAFT,
      explanation: "Test explanation",
    });

    const storeRes = await request(app)
      .get(`/api/quotations/${quotation._id}`)
      .set("Authorization", `Bearer ${storeToken}`);

    expect(storeRes.status).toBe(200);
    expect(storeRes.body.data.quotationNumber).toBe("QT-TEST-001");
    // All cost and margin fields must be completely stripped
    expect(storeRes.body.data.subtotalCostPaise).toBeUndefined();
    expect(storeRes.body.data.materialCostPaise).toBeUndefined();
    expect(storeRes.body.data.wastageCostPaise).toBeUndefined();
    expect(storeRes.body.data.riskBufferCostPaise).toBeUndefined();
    expect(storeRes.body.data.profitPaise).toBeUndefined();
    expect(storeRes.body.data.marginPct).toBeUndefined();
    expect(storeRes.body.data.riskBufferPct).toBeUndefined();
    expect(storeRes.body.data.lineItems[0].unitCostPaise).toBeUndefined();
    expect(storeRes.body.data.lineItems[0].totalCostPaise).toBeUndefined();
    // Non-cost operational fields are preserved
    expect(storeRes.body.data.lineItems[0].requiredQty).toBe(1000);
    expect(storeRes.body.data.lineItems[0].materialName).toBe("Grey Fabric 40s");
  });

  it("Rule 2: Strictly only accounts role can approve payment reminders", async () => {
    const payment = await PaymentModel.create({
      tenantId,
      deliveryId: new mongoose.Types.ObjectId(),
      orderId: new mongoose.Types.ObjectId(),
      customerId: new mongoose.Types.ObjectId(),
      invoiceNumber: "INV-9999",
      totalInvoicePaise: 5000000,
      amountReceivedPaise: 0,
      balancePaise: 5000000,
      dueDate: "2026-12-01",
      status: PaymentStatus.PENDING,
      paymentTerms: "Net 30",
      reminders: [
        {
          reminderNumber: 1,
          channel: NotificationChannel.EMAIL,
          recipient: "billing@customer.test",
          messageBody: "Friendly reminder that invoice INV-9999 is due soon.",
          scheduledDate: "2026-11-25",
          status: ReminderStatus.DRAFT,
        },
      ],
    });

    const reminderId = payment.reminders[0]!._id!.toString();

    // 1. Owner attempt -> Forbidden 403
    const ownerRes = await request(app)
      .post(`/api/payments/${payment._id}/reminders/${reminderId}/approve`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ action: "approve" });

    expect(ownerRes.status).toBe(403);
    expect(ownerRes.body.error).toBe("Forbidden");

    // 2. Sales attempt -> Forbidden 403
    const salesRes = await request(app)
      .post(`/api/payments/${payment._id}/reminders/${reminderId}/approve`)
      .set("Authorization", `Bearer ${salesToken}`)
      .send({ action: "approve" });

    expect(salesRes.status).toBe(403);

    // 3. Accounts attempt -> Allowed 200 OK
    const accountsRes = await request(app)
      .post(`/api/payments/${payment._id}/reminders/${reminderId}/approve`)
      .set("Authorization", `Bearer ${accountsToken}`)
      .send({ action: "approve" });

    expect(accountsRes.status).toBe(200);
    const approvedReminder = accountsRes.body.data.reminders.find(
      (r: any) => r._id === reminderId
    );
    expect(approvedReminder.status).toBe(ReminderStatus.APPROVED);
    expect(approvedReminder.approvedBy).toBeDefined();
  });
});

