import { describe, it, expect } from "vitest";
import request from "supertest";
import RedisMock from "ioredis-mock";
import { createApp } from "../../src/app.js";
import { createContainer } from "../../src/container.js";
import { setRedisClient } from "../../src/config/redis.js";

describe("Stage 3: Auth Rate Limiter Fail-Closed vs Global Limiter Fail-Open", () => {
  it("Auth rate limiter FAILS CLOSED (503 SERVICE_UNAVAILABLE) when Redis is down to prevent brute-force attacks", async () => {
    const container = createContainer();

    // Create a mock Redis that simulates connection failure
    const brokenRedis: any = {
      status: "end",
      eval: async () => {
        throw new Error("ECONNREFUSED: Redis connection unreachable");
      },
      incr: async () => {
        throw new Error("ECONNREFUSED");
      },
      expire: async () => {
        throw new Error("ECONNREFUSED");
      },
      quit: async () => {},
      disconnect: () => {},
    };

    setRedisClient(brokenRedis);
    const appWithBrokenRedis = createApp({
      ...container,
      redisClient: brokenRedis,
    });

    // 1. Auth endpoint must FAIL CLOSED (503)
    const authRes = await request(appWithBrokenRedis)
      .post("/api/v1/auth/login")
      .send({
        email: "test@loompilot.local",
        password: "ValidSecret123!",
      });

    expect(authRes.status).toBe(503);
    expect(authRes.body.error.code).toBe("SERVICE_UNAVAILABLE");
    expect(authRes.body.error.message).toContain("Authentication service is temporarily unavailable");

    // 2. Non-auth endpoints (e.g. GET /health) with global rate limiter FAIL OPEN (200 OK)
    const healthRes = await request(appWithBrokenRedis).get("/health");
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.status).toBe("ok");

    // Restore working mock Redis for subsequent test suites
    const workingRedis = new (RedisMock as any)();
    workingRedis.status = "ready";
    setRedisClient(workingRedis);
  });
});
