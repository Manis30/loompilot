import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { requestIdMiddleware } from "../../src/middleware/request-id.js";

describe("RequestId Middleware", () => {
  const app = express();
  app.use(requestIdMiddleware);
  app.get("/test", (req, res) => {
    res.json({ id: req.id });
  });

  it("generates a new UUID when x-request-id is not provided", async () => {
    const res = await request(app).get("/test");
    expect(res.status).toBe(200);
    expect(res.headers["x-request-id"]).toBeDefined();
    expect(res.body.id).toBe(res.headers["x-request-id"]);
    expect(res.body.id.length).toBeGreaterThan(10);
  });

  it("propagates incoming x-request-id from client", async () => {
    const customId = "trace-req-abc-12345";
    const res = await request(app).get("/test").set("x-request-id", customId);
    expect(res.status).toBe(200);
    expect(res.headers["x-request-id"]).toBe(customId);
    expect(res.body.id).toBe(customId);
  });
});

