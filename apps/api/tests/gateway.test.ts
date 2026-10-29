import { describe, it, beforeAll, afterAll, beforeEach, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { setupTestDB, teardownTestDB, clearTestDB } from "./setup.js";
import { env } from "../src/config/env.js";
import { authService } from "../src/container.js";
import { UserRole, AlertType, AlertSeverity } from "@loompilot/shared";
import mongoose from "mongoose";

describe("Stage 2: Internal Agent Gateway Tests", () => {
  const tenantId = "tenant_gateway_test";
  const validToken = env.INTERNAL_SERVICE_TOKEN;

  beforeAll(async () => {
    await setupTestDB();
  }, 60000);

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  it("rejects calls to /internal without x-service-token header (401)", async () => {
    const res = await request(app)
      .post("/internal/v1/quotations/drafts")
      .send({ tenantId });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("rejects calls with an incorrect service token (403)", async () => {
    const res = await request(app)
      .post("/internal/v1/quotations/drafts")
      .set("x-service-token", "wrong_token_12345678")
      .send({ tenantId });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("rejects user JWT tokens on /internal routes (only service tokens accepted)", async () => {
    await authService.register({
      tenantId,
      email: "owner@gateway.test",
      password: "password123",
      name: "Owner",
      role: UserRole.OWNER,
    });
    const auth = await authService.login({ tenantId, email: "owner@gateway.test", password: "password123" });

    // Pass user JWT instead of service token
    const res = await request(app)
      .post("/internal/v1/quotations/drafts")
      .set("Authorization", `Bearer ${auth!.accessToken}`)
      .send({ tenantId });

    expect(res.status).toBe(401);
  });

  it("ingests draft quotation proposal when valid service token is provided", async () => {
    const proposal = {
      tenantId,
      enquiryId: new mongoose.Types.ObjectId().toString(),
      customerId: new mongoose.Types.ObjectId().toString(),
      lineItems: [
        {
          materialId: new mongoose.Types.ObjectId().toString(),
          materialName: "Cotton Yarn 30s",
          requiredQty: 500,
          unit: "kg",
          onHandQty: 100,
          reservedQty: 0,
          toPurchaseQty: 400,
          unitCostPaise: 25000,
          totalCostPaise: 12500000,
          supplierLeadDays: 7,
        },
      ],
      materialCostPaise: 12500000,
      processingCostPaise: 2000000,
      overheadCostPaise: 500000,
      wastagePct: 2.0,
      wastageCostPaise: 250000,
      riskBufferPct: 3.5,
      riskBufferCostPaise: 437500,
      subtotalCostPaise: 15000000,
      marginPct: 15.0,
      profitPaise: 2353125,
      finalPricePaise: 18040625,
      etaDate: "2026-11-20",
      validUntil: "2026-11-10",
      explanation: "Itemised quotation prepared from stock and supplier lead times.",
    };

    const res = await request(app)
      .post("/internal/v1/quotations/drafts")
      .set("x-service-token", validToken)
      .send(proposal);

    expect(res.status).toBe(201);
    expect(res.body.data.quotationNumber).toBeDefined();
    expect(res.body.data.status).toBe("draft");
    expect(res.body.data.finalPricePaise).toBe(18040625);
  });

  it("ingests production alerts and deduplicates per order + process + date", async () => {
    const alertData = {
      tenantId,
      orderId: new mongoose.Types.ObjectId().toString(),
      processId: new mongoose.Types.ObjectId().toString(),
      date: "2026-10-28",
      type: AlertType.DELAY_WARNING,
      severity: AlertSeverity.HIGH,
      title: "Daily output short by 40%",
      message: "Actual output was 300 meters vs planned 500 meters.",
      metrics: {
        requiredDaily: 500,
        actualRate: 300,
        deficitQty: 200,
        delayDaysEstimated: 2,
      },
    };

    // First ingestion
    const res1 = await request(app)
      .post("/internal/v1/alerts")
      .set("x-service-token", validToken)
      .send(alertData);

    expect(res1.status).toBe(201);
    const alertId = res1.body.data._id;

    // Second ingestion with updated metrics (deduplication / upsert)
    const res2 = await request(app)
      .post("/internal/v1/alerts")
      .set("x-service-token", validToken)
      .send({
        ...alertData,
        message: "Updated: Actual output 320 meters vs planned 500 meters.",
      });

    expect(res2.status).toBe(201);
    expect(res2.body.data._id).toBe(alertId);
    expect(res2.body.data.message).toContain("Updated:");
  });
});

