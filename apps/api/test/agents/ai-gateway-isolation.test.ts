import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import mongoose, { Types } from "mongoose";
import { createApp } from "../../src/app.js";
import { createContainer } from "../../src/container.js";
import { getEnv } from "../../src/config/env.js";
import { OrderModel } from "../../src/models/orders/order.model.js";
import { ClientModel } from "../../src/models/identity/client.model.js";
import { ProductModel } from "../../src/models/catalog/product.model.js";
import { HttpAgentsClient } from "../../src/integrations/agents/http-agents-client.js";
import { ErrorCode } from "@loompilot/shared";

describe("AI Gateway Isolation & Agent Contracts", () => {
  let app: any;
  let tenantId: string;
  let testOrderId: string;
  let testClientId: string;
  let internalSecret: string;

  beforeAll(async () => {
    const container = createContainer();
    app = createApp(container);
    tenantId = "tenant_ai_test_" + Date.now();
    internalSecret = getEnv().AGENT_SERVICE_TOKEN;

    const client = await ClientModel.create({
      tenantId,
      clientName: "AI Test Apparel Corp",
      email: `buyer_${Date.now()}@example.com`,
      contactPerson: "Test Buyer",
      phone: "+919876543210",
      status: "active",
    });
    testClientId = String(client._id);

    const product = await ProductModel.create({
      tenantId,
      productName: "Organic Cotton Twill",
      category: "Woven Fabric",
      basePricePaise: 35000,
      routing: [],
      bom: [],
    });

    const order = await OrderModel.create({
      tenantId,
      orderNumber: "ORD-AI-101",
      clientId: client._id,
      productId: product._id,
      quantity: 1000,
      deliveryDeadline: "2026-12-15",
      productDescription: "Organic Cotton Twill Fabric",
      status: "submitted",
      spec: { sizes: ["M", "L"], fabric: "Cotton Twill" },
    });
    testOrderId = String(order._id);
  });

  afterAll(async () => {
    await OrderModel.deleteMany({ tenantId });
    await ClientModel.deleteMany({ tenantId });
    await ProductModel.deleteMany({ tenantId });
  });

  // =========================================================================
  // 1. Inbound Gateway Security: verifyInternalSecret Middleware
  // =========================================================================
  describe("Inbound Gateway Security (verifyInternalSecret)", () => {
    it("Rejects request with missing secret header (401 UNAUTHENTICATED)", async () => {
      const res = await request(app)
        .post("/internal/v1/feasibility-reports")
        .send({
          schemaVersion: "1.0",
          orderId: testOrderId,
          tenantId,
          verdict: "feasible",
          etaDate: "2026-12-01",
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe(ErrorCode.UNAUTHENTICATED);
    });

    it("Rejects request with invalid secret token (401 UNAUTHENTICATED)", async () => {
      const res = await request(app)
        .post("/internal/v1/feasibility-reports")
        .set("x-internal-secret", "wrong_token_12345")
        .send({
          schemaVersion: "1.0",
          orderId: testOrderId,
          tenantId,
          verdict: "feasible",
          etaDate: "2026-12-01",
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe(ErrorCode.UNAUTHENTICATED);
    });

    it("Accepts secret via x-agent-service-token header", async () => {
      // Transition order to 'analyzing' to satisfy finite state machine for feasibility ingestion
      await OrderModel.findByIdAndUpdate(testOrderId, { status: "analyzing" });

      const res = await request(app)
        .post("/internal/v1/feasibility-reports")
        .set("x-agent-service-token", internalSecret)
        .send({
          schemaVersion: "1.0",
          orderId: testOrderId,
          tenantId,
          verdict: "feasible",
          etaDate: "2026-12-01",
          reasonsSummary: "All materials and capacities verified feasible.",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // =========================================================================
  // 2. Schema Validation on Inbound Gateway Payloads
  // =========================================================================
  describe("Inbound Gateway Schema Validation", () => {
    it("Rejects malformed feasibility report missing required fields (400 VALIDATION_FAILED)", async () => {
      const res = await request(app)
        .post("/internal/v1/feasibility-reports")
        .set("x-internal-secret", internalSecret)
        .send({
          // Missing orderId, tenantId, etaDate
          schemaVersion: "1.0",
          verdict: "feasible",
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ErrorCode.VALIDATION_FAILED);
    });

    it("Rejects malformed quotation draft with missing required fields (400 VALIDATION_FAILED)", async () => {
      const res = await request(app)
        .post("/internal/v1/quotation-drafts")
        .set("x-internal-secret", internalSecret)
        .send({
          schemaVersion: "1.0",
          orderId: testOrderId,
          tenantId,
          // Missing unitPricePaise, totalPaise, etaDate, paymentSchedule
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ErrorCode.VALIDATION_FAILED);
    });

    it("Rejects malformed quotation revision payload (400 VALIDATION_FAILED)", async () => {
      const res = await request(app)
        .post("/internal/v1/quotation-revisions")
        .set("x-internal-secret", internalSecret)
        .send({
          orderId: testOrderId,
          tenantId,
          // Missing reasonType, oldPricePaise, newPricePaise, changePct, clientReason
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ErrorCode.VALIDATION_FAILED);
    });
  });

  // =========================================================================
  // 3. Ingestion & Persistence of Feasibility & Quotations
  // =========================================================================
  describe("Ingestion & Business Rules Verification", () => {
    it("Ingests valid quotation draft and transitions order to quotation_pending_approval", async () => {
      // Transition order to 'quotation_drafting' to satisfy state machine precondition
      await OrderModel.findByIdAndUpdate(testOrderId, { status: "quotation_drafting" });

      const res = await request(app)
        .post("/internal/v1/quotation-drafts")
        .set("x-internal-secret", internalSecret)
        .send({
          schemaVersion: "1.0",
          orderId: testOrderId,
          tenantId,
          unitPricePaise: 38000,
          totalPaise: 38000000,
          etaDate: "2026-12-10",
          paymentSchedule: [
            {
              milestone: "Advance Deposit",
              trigger: "advance",
              percent: 30,
              amountPaise: 11400000,
            },
            {
              milestone: "Final Balance",
              trigger: "stage",
              stage: "dispatch",
              percent: 70,
              amountPaise: 26600000,
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const order = await OrderModel.findById(testOrderId).lean();
      expect(order!.status).toBe("quotation_pending_approval");
      expect(order!.quotation?.unitPricePaise).toBe(38000);
      expect(order!.quotation?.totalPaise).toBe(38000000);
    });

    it("Rejects quotation draft for non-existent order (404 NOT_FOUND)", async () => {
      const nonExistentId = new Types.ObjectId().toString();
      const res = await request(app)
        .post("/internal/v1/quotation-drafts")
        .set("x-internal-secret", internalSecret)
        .send({
          schemaVersion: "1.0",
          orderId: nonExistentId,
          tenantId,
          unitPricePaise: 40000,
          totalPaise: 40000000,
          etaDate: "2026-12-10",
          paymentSchedule: [
            {
              milestone: "Full",
              trigger: "advance",
              percent: 100,
              amountPaise: 40000000,
            },
          ],
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe(ErrorCode.NOT_FOUND);
    });

    it("Rejects cross-tenant quotation injection (404 NOT_FOUND)", async () => {
      const otherTenantId = "tenant_attacker_999";
      const res = await request(app)
        .post("/internal/v1/quotation-drafts")
        .set("x-internal-secret", internalSecret)
        .send({
          schemaVersion: "1.0",
          orderId: testOrderId,
          tenantId: otherTenantId,
          unitPricePaise: 40000,
          totalPaise: 40000000,
          etaDate: "2026-12-10",
          paymentSchedule: [
            {
              milestone: "Full",
              trigger: "advance",
              percent: 100,
              amountPaise: 40000000,
            },
          ],
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe(ErrorCode.NOT_FOUND);
    });
  });

  // =========================================================================
  // 4. Outbound HttpAgentsClient Resilience & Error Handling
  // =========================================================================
  describe("Outbound HttpAgentsClient Resilience", () => {
    it("Handles agent service timeout gracefully and returns unavailable result without crashing", async () => {
      const client = new HttpAgentsClient({
        baseUrl: "http://127.0.0.1:59999",
        serviceToken: "test-token",
        timeoutMs: 300,
        maxRetries: 0,
      });

      const result = await client.requestFeasibility({
        tenantId: "tenant_test",
        orderId: "ord_123",
        quantity: 500,
        deadline: "2026-12-01",
      });

      expect(result.success).toBe(false);
      expect(result.unavailable).toBe(true);
      expect(result.error).toBe(ErrorCode.AGENTS_UNAVAILABLE);
    });

    it("Does not fabricate successful results on connection failure", async () => {
      const client = new HttpAgentsClient({
        baseUrl: "http://127.0.0.1:59999",
        serviceToken: "test-token",
        timeoutMs: 200,
        maxRetries: 0,
      });

      const result = await client.requestQuotationDraft({
        tenantId: "tenant_test",
        orderId: "ord_123",
        quantity: 1000,
      });

      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.unavailable).toBe(true);
    });
  });
});
