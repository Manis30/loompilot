import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { createContainer } from "../../src/container.js";

describe("Health & Readiness Endpoints", () => {
  const container = createContainer();
  const app = createApp(container);

  it("GET /health returns 200 with status ok and uptime", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.uptime).toBeDefined();
    expect(res.body.timestamp).toBeDefined();
  });

  it("GET /ready returns 200 when mongo and redis are connected", async () => {
    const res = await request(app).get("/ready");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ready");
    expect(res.body.mongo).toBe("connected");
    expect(res.body.redis).toBe("connected");
    expect(res.body.timestamp).toBeDefined();
  });

  it("GET /api/v1/health also works via prefix", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("GET /docs.json returns valid OpenAPI spec in non-production", async () => {
    const res = await request(app).get("/docs.json");
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe("3.0.3");
    expect(res.body.info.title).toBe("LoomPilot API");
    expect(res.body.paths["/health"]).toBeDefined();
    expect(res.body.paths["/ready"]).toBeDefined();
  });

  it("disables Swagger endpoints when NODE_ENV === 'production'", async () => {
    const prodContainer = {
      ...container,
      env: {
        ...container.env,
        NODE_ENV: "production" as const,
      },
    };
    const prodApp = createApp(prodContainer);

    const res = await request(prodApp).get("/docs.json");
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("GET /unmatched-route returns 404 with standardized AppError", async () => {
    const res = await request(app).get("/non-existent-route");
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(res.body.error.requestId).toBeDefined();
  });
});
