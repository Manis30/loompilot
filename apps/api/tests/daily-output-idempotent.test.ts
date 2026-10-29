import { describe, it, beforeAll, afterAll, beforeEach, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { setupTestDB, teardownTestDB, clearTestDB } from "./setup.js";
import { authService, workforceService } from "../src/container.js";
import { UserRole } from "@loompilot/shared";
import mongoose from "mongoose";

describe("Table-Driven & Integration: Daily-Output Idempotent Entry", () => {
  const tenantId = "tenant_idempotency_test";
  let managerToken: string;

  beforeAll(async () => {
    await setupTestDB();
  }, 60000);

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    // Setup Owner (first user) & Manager
    const owner = await authService.register({
      tenantId,
      email: "owner@idempotent.test",
      password: "password123",
      name: "Owner",
      role: UserRole.OWNER,
    });
    const manager = await authService.register(
      {
        tenantId,
        email: "manager@idempotent.test",
        password: "password123",
        name: "Manager",
        role: UserRole.MANAGER,
      },
      { tenantId, userId: owner.id, role: UserRole.OWNER, email: owner.email }
    );

    const loginRes = await authService.login({
      tenantId,
      email: "manager@idempotent.test",
      password: "password123",
    });
    managerToken = loginRes.accessToken;
  });

  it("submitting the same order, process, and date twice returns the existing record instead of a duplicate-key error (HTTP API)", async () => {
    const payload = {
      orderId: new mongoose.Types.ObjectId().toString(),
      processId: new mongoose.Types.ObjectId().toString(),
      date: "2026-10-28",
      quantityProduced: 450,
      quantityDefective: 5,
      operatorId: "op_42",
      notes: "First run entry",
      idempotencyKey: "idem_key_output_001",
    };

    // First submission
    const res1 = await request(app)
      .post("/api/v1/workforce/daily-outputs")
      .set("Authorization", `Bearer ${managerToken}`)
      .send(payload);

    expect(res1.status).toBe(201);
    expect(res1.body.data.id).toBeDefined();
    const createdId = res1.body.data.id;
    expect(res1.body.data.quantityProduced).toBe(450);

    // Second submission with exact same orderId + processId + date (different idempotency key)
    const res2 = await request(app)
      .post("/api/v1/workforce/daily-outputs")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        ...payload,
        idempotencyKey: "idem_key_output_002",
        notes: "Second duplicate submission",
      });

    // Must NOT fail with MongoDB duplicate key E11000 error
    expect(res2.status).toBe(201);
    expect(res2.body.data.id).toBe(createdId);
  });

  it("service layer directly verifies idempotencyKey deduplication and compound upsert", async () => {
    const actor = {
      tenantId,
      userId: "usr_mgr",
      role: UserRole.MANAGER,
      email: "mgr@test.com",
    };

    const input = {
      orderId: new mongoose.Types.ObjectId().toString(),
      processId: new mongoose.Types.ObjectId().toString(),
      date: "2026-10-29",
      quantityProduced: 600,
      idempotencyKey: "idem_key_srv_001",
    };

    const out1 = await workforceService.recordDailyOutput(actor, input);
    const out2 = await workforceService.recordDailyOutput(actor, input);

    expect(out1.id).toBe(out2.id);
    expect(out2.quantityProduced).toBe(600);
  });

  it("returns 409 IDEMPOTENCY_CONFLICT when same idempotency key is submitted with different body", async () => {
    const payloadA = {
      orderId: new mongoose.Types.ObjectId().toString(),
      processId: new mongoose.Types.ObjectId().toString(),
      date: "2026-10-30",
      quantityProduced: 200,
    };

    // First request with key
    const resA = await request(app)
      .post("/api/v1/workforce/daily-outputs")
      .set("Authorization", `Bearer ${managerToken}`)
      .set("Idempotency-Key", "idem_conflict_test_key_01")
      .send(payloadA);

    expect(resA.status).toBe(201);

    // Second request with SAME key but DIFFERENT body (different quantityProduced)
    const resB = await request(app)
      .post("/api/v1/workforce/daily-outputs")
      .set("Authorization", `Bearer ${managerToken}`)
      .set("Idempotency-Key", "idem_conflict_test_key_01")
      .send({ ...payloadA, quantityProduced: 999 });

    expect(resB.status).toBe(409);
    expect(resB.body.error.code).toBe("IDEMPOTENCY_CONFLICT");
  });
});
