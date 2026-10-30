import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { createContainer } from "../../src/container.js";
import { RefreshTokenModel } from "../../src/models/platform/refresh-token.model.js";
import { AuditLogModel } from "../../src/models/platform/audit-log.model.js";
import { createTestUser } from "../helpers/auth-helper.js";

describe("Stage 3: Refresh Token Rotation & Family Reuse Detection", () => {
  const container = createContainer();
  const app = createApp(container);

  it("Rotates refresh token on each use, revoking the predecessor while keeping the family", async () => {
    const { user, plainPassword } = await createTestUser({ email: "rotation.test@mill.local" });

    // Initial Login
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({
        tenantId: user.tenantId,
        email: user.email,
        password: plainPassword,
      });

    expect(loginRes.status).toBe(200);
    const loginCookies = loginRes.headers["set-cookie"] as unknown as string[];
    const firstRefreshToken = loginRes.body.refreshToken;
    expect(firstRefreshToken).toBeDefined();

    // Use refresh token
    const refreshRes = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", loginCookies)
      .send({ refreshToken: firstRefreshToken });

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toBeDefined();
    const secondRefreshToken = refreshRes.body.refreshToken;
    expect(secondRefreshToken).toBeDefined();
    expect(secondRefreshToken).not.toBe(firstRefreshToken);

    // Verify first token is marked as revoked in MongoDB
    const allTokens = await RefreshTokenModel.find({ subjectId: user._id }).sort({ createdAt: 1 });
    expect(allTokens.length).toBe(2);
    expect(allTokens[0]?.familyId).toBe(allTokens[1]?.familyId);
    expect(allTokens[0]?.revokedAt).toBeDefined();
    expect(allTokens[1]?.revokedAt).toBeUndefined();
  });

  it("Detects reuse of an old refresh token: revokes entire family and returns 401 TOKEN_REUSE_DETECTED", async () => {
    const { user, plainPassword } = await createTestUser({ email: "reuse.test@mill.local" });

    // Login
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({
        tenantId: user.tenantId,
        email: user.email,
        password: plainPassword,
      });

    const firstToken = loginRes.body.refreshToken;

    // Normal rotation
    const refreshRes = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: firstToken });

    expect(refreshRes.status).toBe(200);

    // Wait past the 10-second REFRESH_RACE grace period by manually backdating revokedAt
    await RefreshTokenModel.updateMany(
      { subjectId: user._id, revokedAt: { $exists: true } },
      { $set: { revokedAt: new Date(Date.now() - 15000) } } // 15s ago (> 10s grace window)
    );

    // Malicious attacker reuses firstToken
    const reuseRes = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: firstToken });

    expect(reuseRes.status).toBe(401);
    expect(reuseRes.body.error.code).toBe("TOKEN_REUSE_DETECTED");

    // All tokens in the family must now be revoked
    const familyTokens = await RefreshTokenModel.find({ subjectId: user._id });
    for (const t of familyTokens) {
      expect(t.revokedAt).toBeDefined();
    }

    // Audit log entry created
    const audit = await AuditLogModel.findOne({
      tenantId: user.tenantId,
      action: "TOKEN_REUSE_DETECTED",
    });
    expect(audit).toBeDefined();
    expect(audit?.action).toBe("TOKEN_REUSE_DETECTED");
  });

  it("REFRESH_RACE: Concurrent request within 10s grace period gets 409 without destroying family", async () => {
    const { user, plainPassword } = await createTestUser({ email: "race.test@mill.local" });

    // Initial Login
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({
        tenantId: user.tenantId,
        email: user.email,
        password: plainPassword,
      });

    const firstToken = loginRes.body.refreshToken;

    // First tab rotates token
    const firstTabRes = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: firstToken });

    expect(firstTabRes.status).toBe(200);

    // Second parallel tab sends request with the same firstToken within 10s
    const secondTabRes = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: firstToken });

    expect(secondTabRes.status).toBe(409);
    expect(secondTabRes.body.error.code).toBe("REFRESH_RACE");

    // The active second token from the first tab MUST NOT be revoked!
    const activeTokens = await RefreshTokenModel.find({
      subjectId: user._id,
      revokedAt: { $exists: false },
    });
    expect(activeTokens.length).toBe(1);
  });
});
