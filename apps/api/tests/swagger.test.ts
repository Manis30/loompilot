import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { openapiSpec } from "../src/docs/openapi.js";

describe("OpenAPI Specification & Swagger UI Integration", () => {
  describe("GET /api-docs.json", () => {
    it("returns 200 OK and valid OpenAPI 3.0.3 JSON schema", async () => {
      const res = await request(app)
        .get("/api-docs.json")
        .expect("Content-Type", /json/)
        .expect(200);

      expect(res.body.openapi).toBe("3.0.3");
      expect(res.body.info.title).toContain("LoomPilot");
      expect(res.body.info.version).toBe("0.1.0");
      expect(res.body.servers).toBeInstanceOf(Array);
      expect(res.body.servers.length).toBeGreaterThan(0);
    });

    it("defines standard security schemes (bearerAuth, cookieAuth, serviceTokenAuth)", async () => {
      const res = await request(app).get("/api-docs.json").expect(200);
      const { securitySchemes } = res.body.components;

      expect(securitySchemes).toBeDefined();
      expect(securitySchemes.bearerAuth).toBeDefined();
      expect(securitySchemes.bearerAuth.type).toBe("http");
      expect(securitySchemes.bearerAuth.scheme).toBe("bearer");

      expect(securitySchemes.cookieAuth).toBeDefined();
      expect(securitySchemes.cookieAuth.type).toBe("apiKey");
      expect(securitySchemes.cookieAuth.in).toBe("cookie");
      expect(securitySchemes.cookieAuth.name).toBe("loompilot_refresh_token");

      expect(securitySchemes.serviceTokenAuth).toBeDefined();
      expect(securitySchemes.serviceTokenAuth.type).toBe("apiKey");
      expect(securitySchemes.serviceTokenAuth.in).toBe("header");
      expect(securitySchemes.serviceTokenAuth.name).toBe("x-service-token");
    });

    it("documents all key business entity schemas", async () => {
      const res = await request(app).get("/api-docs.json").expect(200);
      const { schemas } = res.body.components;

      const requiredSchemas = [
        "User",
        "LoginRequest",
        "LoginResponse",
        "Customer",
        "Supplier",
        "Material",
        "StockMovement",
        "Process",
        "Worker",
        "AttendanceRecord",
        "DailyOutput",
        "Quotation",
        "ProductionOrder",
        "OrderVarianceReport",
        "Delivery",
        "Payment",
        "Alert",
        "Recommendation",
        "MarginReport",
        "OnTimeReport",
        "CollectionsReport",
        "StandardError",
        "ValidationError",
        "HealthResponse",
      ];

      for (const schemaName of requiredSchemas) {
        expect(schemas[schemaName], `Schema ${schemaName} should exist`).toBeDefined();
      }
    });

    it("documents complete paths across all 15 operational modules", async () => {
      const res = await request(app).get("/api-docs.json").expect(200);
      const { paths } = res.body;

      // Check key endpoints across modules
      const expectedPaths = [
        "/health",
        "/api/auth/login",
        "/api/auth/refresh",
        "/api/auth/register",
        "/api/auth/logout",
        "/api/auth/me",
        "/api/customers",
        "/api/customers/{id}",
        "/api/enquiries",
        "/api/enquiries/{id}",
        "/api/quotations",
        "/api/quotations/draft",
        "/api/quotations/{id}",
        "/api/quotations/{id}/recalculate",
        "/api/quotations/{id}/approve",
        "/api/quotations/{id}/send",
        "/api/quotations/{id}/pdf",
        "/api/quotations/{id}/confirm",
        "/api/materials",
        "/api/materials/{id}",
        "/api/materials/{id}/movements",
        "/api/materials/{id}/price-history",
        "/api/suppliers",
        "/api/suppliers/{id}",
        "/api/processes",
        "/api/processes/{id}",
        "/api/workforce/workers",
        "/api/workforce/attendance",
        "/api/workforce/daily-outputs",
        "/api/workforce/orders/{orderId}/outputs",
        "/api/orders",
        "/api/orders/{id}",
        "/api/orders/{id}/variance",
        "/api/alerts",
        "/api/alerts/{id}/ack",
        "/api/alerts/recommendations",
        "/api/alerts/recommendations/{id}/decide",
        "/api/deliveries",
        "/api/deliveries/{id}",
        "/api/payments",
        "/api/payments/{id}",
        "/api/payments/{id}/reminders/{reminderId}/approve",
        "/api/payments/{id}/receipts",
        "/api/reports/margin",
        "/api/reports/on-time",
        "/api/reports/collections",
        "/internal/quotations/drafts",
        "/internal/alerts",
        "/internal/recommendations",
        "/internal/monitoring-snapshots",
        "/internal/payment-followups",
        "/internal/payment-reminder-drafts",
      ];

      for (const p of expectedPaths) {
        expect(paths[p], `Path ${p} should be documented in OpenAPI spec`).toBeDefined();
      }

      // Ensure at least 45 unique path entries
      expect(Object.keys(paths).length).toBeGreaterThanOrEqual(45);
    });

    it("correctly documents binary PDF download for quotations", async () => {
      const res = await request(app).get("/api-docs.json").expect(200);
      const pdfEndpoint = res.body.paths["/api/quotations/{id}/pdf"].get;

      expect(pdfEndpoint).toBeDefined();
      expect(pdfEndpoint.operationId).toBe("downloadQuotationPdf");
      expect(pdfEndpoint.responses["200"].content["application/pdf"]).toBeDefined();
      expect(pdfEndpoint.responses["200"].content["application/pdf"].schema.format).toBe("binary");
    });

    it("documents role restrictions for sensitive routes in descriptions and tags", async () => {
      const res = await request(app).get("/api-docs.json").expect(200);

      // Payment reminders approval: strictly accounts
      const approveReminder = res.body.paths["/api/payments/{id}/reminders/{reminderId}/approve"].post;
      expect(approveReminder.description).toContain("accounts");

      // Margin report: owner & accounts
      const marginReport = res.body.paths["/api/reports/margin"].get;
      expect(marginReport.description).toContain("owner");
      expect(marginReport.description).toContain("accounts");

      // Internal agent gateway: service token
      const internalAlerts = res.body.paths["/internal/alerts"].post;
      expect(internalAlerts.security).toEqual([{ serviceTokenAuth: [] }]);
    });
  });

  describe("GET /api-docs (Swagger UI Explorer)", () => {
    it("serves HTML documentation at /api-docs/", async () => {
      const res = await request(app)
        .get("/api-docs/")
        .expect("Content-Type", /html/)
        .expect(200);

      expect(res.text).toContain("swagger-ui");
      expect(res.text).toContain("LoomPilot - Interactive API Explorer");
    });
  });
});
