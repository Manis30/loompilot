import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { z } from "zod";
import { ErrorCode } from "@loompilot/shared";
import { requestIdMiddleware } from "../../src/middleware/request-id.js";
import { errorHandler } from "../../src/middleware/error-handler.js";
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
  InvalidTransitionError,
} from "../../src/errors/app-error.js";

describe("Global Error Handler Middleware", () => {
  const app = express();
  app.use(express.json());
  app.use(requestIdMiddleware);

  app.get("/not-found", () => {
    throw new NotFoundError("Order");
  });

  app.get("/forbidden", () => {
    throw new ForbiddenError("Store role cannot view costs");
  });

  app.get("/invalid-transition", () => {
    throw new InvalidTransitionError("draft", "confirmed", "Order");
  });

  app.post("/zod-error", (req) => {
    const schema = z.object({
      quantity: z.number().positive(),
    });
    schema.parse(req.body);
  });

  app.get("/mongo-duplicate", () => {
    const err = new Error("E11000 duplicate key error");
    (err as any).code = 11000;
    (err as any).keyPattern = { orderNumber: 1 };
    throw err;
  });

  app.get("/unhandled-error", () => {
    throw new Error("Database network failure");
  });

  app.use(errorHandler);

  it("handles NotFoundError with 404 and standard error envelope", async () => {
    const res = await request(app).get("/not-found");
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe(ErrorCode.NOT_FOUND);
    expect(res.body.error.message).toBe("Order not found");
    expect(res.body.error.requestId).toBeDefined();
  });

  it("handles ForbiddenError with 403", async () => {
    const res = await request(app).get("/forbidden");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN);
    expect(res.body.error.message).toBe("Store role cannot view costs");
  });

  it("handles InvalidTransitionError with 422 and details", async () => {
    const res = await request(app).get("/invalid-transition");
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe(ErrorCode.INVALID_TRANSITION);
    expect(res.body.error.details).toEqual({
      from: "draft",
      to: "confirmed",
      entity: "Order",
    });
  });

  it("handles Zod validation error with 400 and issues list", async () => {
    const res = await request(app)
      .post("/zod-error")
      .send({ quantity: -5 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(Array.isArray(res.body.error.details)).toBe(true);
    expect(res.body.error.details[0].field).toBe("quantity");
  });

  it("handles Mongo duplicate key (11000) with 409", async () => {
    const res = await request(app).get("/mongo-duplicate");
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe(ErrorCode.DUPLICATE);
    expect(res.body.error.details).toEqual({ orderNumber: 1 });
  });

  it("handles unexpected error with 500 and INTERNAL_ERROR code", async () => {
    const res = await request(app).get("/unhandled-error");
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(res.body.error.requestId).toBeDefined();
  });
});

