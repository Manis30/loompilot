import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import { Redis } from "ioredis";
import RedisMock from "ioredis-mock";
import rateLimit from "express-rate-limit";
import { RedisRateLimitStore } from "../../src/middleware/rate-limiter.js";
import { createApp } from "../../src/app.js";
import { createContainer, AppContainer } from "../../src/container.js";

describe("Middleware: Rate Limiter, Body Limit, and Production Swagger", () => {
  it("enforces rate limits and returns 429 when max requests are exceeded", async () => {
    const redis = new (RedisMock as unknown as typeof Redis)();
    const app = express();

    app.use(
      rateLimit({
        windowMs: 60000,
        max: 3, // strictly 3 requests per minute
        store: new RedisRateLimitStore(redis, "test_rl:"),
        standardHeaders: true,
        legacyHeaders: false,
        handler: (_req, res) => {
          res.status(429).json({ error: "TOO_MANY_REQUESTS", message: "Rate limit exceeded" });
        },
      })
    );

    app.get("/test-endpoint", (_req, res) => {
      res.status(200).json({ ok: true });
    });

    // Requests 1, 2, 3 must pass
    const res1 = await request(app).get("/test-endpoint");
    expect(res1.status).toBe(200);

    const res2 = await request(app).get("/test-endpoint");
    expect(res2.status).toBe(200);

    const res3 = await request(app).get("/test-endpoint");
    expect(res3.status).toBe(200);

    // Request 4 must be rate limited
    const res4 = await request(app).get("/test-endpoint");
    expect(res4.status).toBe(429);
    expect(res4.body.error).toBe("TOO_MANY_REQUESTS");
  });

  it("fails open when Redis store throws an error, preserving service availability", async () => {
    // Failing Redis mock
    const failingRedis = {
      eval: async () => {
        throw new Error("Redis cluster disconnected");
      },
      decr: async () => {},
      del: async () => {},
    } as unknown as Redis;

    const store = new RedisRateLimitStore(failingRedis, "fail_open_test:");
    store.init({ windowMs: 60000 } as any);

    const result = await store.increment("test_ip");
    // Verify it failed open: returns totalHits = 1 and future resetTime
    expect(result.totalHits).toBe(1);
    expect(result.resetTime.getTime()).toBeGreaterThan(Date.now());
  });

  it("returns 413 Payload Too Large when request body exceeds configured limit", async () => {
    const baseContainer = createContainer();
    const mockContainer: AppContainer = {
      ...baseContainer,
      env: { ...baseContainer.env, BODY_LIMIT: "50b" }, // tiny 50-byte limit
    };

    const app = createApp(mockContainer);

    // Endpoint expecting JSON
    app.post("/test-body-size", (req, res) => {
      res.json({ received: req.body });
    });

    // Send payload exceeding 50 bytes (e.g. 500 bytes)
    const largePayload = { text: "x".repeat(500) };

    const res = await request(app)
      .post("/test-body-size")
      .send(largePayload)
      .set("Content-Type", "application/json");

    expect(res.status).toBe(413);
  });

  it("returns 404 for Swagger endpoints when NODE_ENV=production", async () => {
    const baseContainer = createContainer();
    const mockContainer: AppContainer = {
      ...baseContainer,
      env: { ...baseContainer.env, NODE_ENV: "production" as const },
    };

    const app = createApp(mockContainer);

    // In production, /docs, /api-docs, /docs.json must not be registered and return 404
    const docsRes = await request(app).get("/docs");
    expect(docsRes.status).toBe(404);

    const apiDocsRes = await request(app).get("/api-docs");
    expect(apiDocsRes.status).toBe(404);

    const docsJsonRes = await request(app).get("/docs.json");
    expect(docsJsonRes.status).toBe(404);
  });
});
