import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { createContainer } from "../../src/container.js";
import { IdempotencyKeyModel } from "../../src/models/platform/idempotency-key.model.js";
import { TokenService } from "../../src/services/token.service.js";
import { createTestClientAccount } from "../helpers/auth-helper.js";

describe("Stage 3: Idempotency Middleware", () => {
  const container = createContainer();
  const app = createApp(container);
  const tenantId = "tenant_idempotency_test";

  it("Executes once, replays completed response with 'Idempotent-Replay: true', and rejects payload mismatch with 422", async () => {
    const { account } = await createTestClientAccount({
      tenantId,
      status: "invited",
      email: "idempotency.client@acme.local",
    });

    const inviteToken = TokenService.generateInviteToken({
      accountId: String(account._id),
      tenantId,
    });

    const idempotencyKey = `idemp-key-${Date.now()}`;

    // 1. First execution -> 200 OK
    const firstRes = await request(app)
      .post("/api/v1/client/auth/accept-invite")
      .set("Idempotency-Key", idempotencyKey)
      .set("x-tenant-id", tenantId)
      .send({
        tenantId,
        token: inviteToken,
        password: "NewSecretPassword123!",
      });

    expect(firstRes.status).toBe(200);
    expect(firstRes.headers["idempotent-replay"]).toBeUndefined();
    expect(firstRes.body.success).toBe(true);

    // Verify record in MongoDB is marked 'completed'
    const stored = await IdempotencyKeyModel.findOne({
      tenantId,
      key: idempotencyKey,
    });
    expect(stored).not.toBeNull();
    expect(stored?.state).toBe("completed");
    expect(stored?.responseStatus).toBe(200);

    // 2. Replay with identical key & payload -> Returns cached response with header 'Idempotent-Replay: true'
    const replayRes = await request(app)
      .post("/api/v1/client/auth/accept-invite")
      .set("Idempotency-Key", idempotencyKey)
      .set("x-tenant-id", tenantId)
      .send({
        tenantId,
        token: inviteToken,
        password: "NewSecretPassword123!",
      });

    expect(replayRes.status).toBe(200);
    expect(replayRes.headers["idempotent-replay"]).toBe("true");
    expect(replayRes.body.success).toBe(true);

    // 3. Reuse same key with different payload -> 422 IDEMPOTENCY_KEY_REUSED
    const mismatchRes = await request(app)
      .post("/api/v1/client/auth/accept-invite")
      .set("Idempotency-Key", idempotencyKey)
      .set("x-tenant-id", tenantId)
      .send({
        tenantId,
        token: inviteToken,
        password: "DifferentPassword456!",
      });

    expect(mismatchRes.status).toBe(422);
    expect(mismatchRes.body.error.code).toBe("IDEMPOTENCY_KEY_REUSED");
  });

  it("Returns 409 IDEMPOTENCY_IN_PROGRESS when another request is currently in-progress", async () => {
    const key = `in-prog-${Date.now()}`;
    const route = "POST /api/v1/client/auth/accept-invite";

    // Simulate an in-progress request claim
    await IdempotencyKeyModel.create({
      tenantId,
      key,
      route,
      requestHash: "some_hash_val",
      state: "in_progress",
      expiresAt: new Date(Date.now() + 60000),
    });

    const res = await request(app)
      .post("/api/v1/client/auth/accept-invite")
      .set("Idempotency-Key", key)
      .send({
        tenantId,
        token: "dummy_token",
        password: "ValidPassword123!",
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("IDEMPOTENCY_IN_PROGRESS");
  });
});
