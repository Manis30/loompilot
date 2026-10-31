import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { createContainer } from "../../src/container.js";
import { RefreshTokenModel } from "../../src/models/platform/refresh-token.model.js";
import { AuditLogModel } from "../../src/models/platform/audit-log.model.js";
import { createTestUser, createTestClientAccount } from "../helpers/auth-helper.js";

function extractRefreshToken(res: request.Response): string {
  const cookies = res.headers["set-cookie"];
  if (!cookies) return "";
  const cookieList = Array.isArray(cookies) ? cookies : [cookies];
  for (const c of cookieList) {
    const match = c.match(/refreshToken=([^;]+)/);
    if (match && match[1]) return decodeURIComponent(match[1]);
  }
  return "";
}

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
    // Strict requirement: refresh token is NOT in JSON body
    expect(loginRes.body.refreshToken).toBeUndefined();

    const loginCookies = loginRes.headers["set-cookie"] as unknown as string[];
    expect(loginCookies).toBeDefined();
    const firstRefreshToken = extractRefreshToken(loginRes);
    expect(firstRefreshToken).toBeTruthy();

    // Use refresh token via Cookie header
    const refreshRes = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", loginCookies);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toBeDefined();
    // Strict requirement: refresh token is NOT in JSON body
    expect(refreshRes.body.refreshToken).toBeUndefined();

    const secondRefreshToken = extractRefreshToken(refreshRes);
    expect(secondRefreshToken).toBeTruthy();
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

    const loginCookies = loginRes.headers["set-cookie"] as unknown as string[];
    const firstToken = extractRefreshToken(loginRes);

    // Normal rotation
    const refreshRes = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", loginCookies);

    expect(refreshRes.status).toBe(200);

    // Wait past the 10-second REFRESH_RACE grace period by manually backdating revokedAt
    await RefreshTokenModel.updateMany(
      { subjectId: user._id, revokedAt: { $exists: true } },
      { $set: { revokedAt: new Date(Date.now() - 15000) } } // 15s ago (> 10s grace window)
    );

    // Malicious attacker reuses firstToken
    const reuseRes = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", [`refreshToken=${firstToken}`])
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

    const loginCookies = loginRes.headers["set-cookie"] as unknown as string[];
    const firstToken = extractRefreshToken(loginRes);

    // First tab rotates token
    const firstTabRes = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", loginCookies);

    expect(firstTabRes.status).toBe(200);

    // Second parallel tab sends request with the same firstToken within 10s
    const secondTabRes = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", [`refreshToken=${firstToken}`])
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

  it("Enforces Origin check on cookie refresh and logout, blocking unauthorized cross-origin requests with 403", async () => {
    const { user, plainPassword } = await createTestUser({ email: "origin.test@mill.local" });

    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({
        tenantId: user.tenantId,
        email: user.email,
        password: plainPassword,
      });

    const loginCookies = loginRes.headers["set-cookie"] as unknown as string[];

    // 1. Refresh with unauthorized Origin header is blocked with 403 FORBIDDEN
    const blockedRefresh = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", loginCookies)
      .set("Origin", "https://malicious-attacker.com");

    expect(blockedRefresh.status).toBe(403);
    expect(blockedRefresh.body.error.code).toBe("FORBIDDEN");
    expect(blockedRefresh.body.error.message).toContain("Cross-Origin request from origin");

    // 2. Logout with unauthorized Origin header is blocked with 403 FORBIDDEN
    const blockedLogout = await request(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", loginCookies)
      .set("Origin", "https://malicious-attacker.com");

    expect(blockedLogout.status).toBe(403);
    expect(blockedLogout.body.error.code).toBe("FORBIDDEN");
    expect(blockedLogout.body.error.message).toContain("Cross-Origin request from origin");

    // 3. Client realm: Refresh and logout with unauthorized Origin header
    const { account, plainPassword: clientPass } = await createTestClientAccount({
      email: "client.origin@acme.local",
    });

    const clientLoginRes = await request(app)
      .post("/api/v1/client/auth/login")
      .send({
        tenantId: account.tenantId,
        email: account.email,
        password: clientPass,
      });

    const clientCookies = clientLoginRes.headers["set-cookie"] as unknown as string[];

    const clientBlockedRefresh = await request(app)
      .post("/api/v1/client/auth/refresh")
      .set("Cookie", clientCookies)
      .set("Origin", "https://malicious-attacker.com");

    expect(clientBlockedRefresh.status).toBe(403);
    expect(clientBlockedRefresh.body.error.code).toBe("FORBIDDEN");

    const clientBlockedLogout = await request(app)
      .post("/api/v1/client/auth/logout")
      .set("Cookie", clientCookies)
      .set("Origin", "https://malicious-attacker.com");

    expect(clientBlockedLogout.status).toBe(403);
    expect(clientBlockedLogout.body.error.code).toBe("FORBIDDEN");
  });

  it("Asserts refreshToken is strictly absent from the body of every login and refresh route across both realms", async () => {
    // 1. Staff User Login and Refresh
    const { user, plainPassword } = await createTestUser({ email: "nobody.user@mill.local" });

    const userLoginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({
        tenantId: user.tenantId,
        email: user.email,
        password: plainPassword,
      });

    expect(userLoginRes.status).toBe(200);
    expect(userLoginRes.body.refreshToken).toBeUndefined();
    expect(userLoginRes.body.refresh_token).toBeUndefined();

    const userCookies = userLoginRes.headers["set-cookie"] as unknown as string[];
    const userRefreshRes = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", userCookies);

    expect(userRefreshRes.status).toBe(200);
    expect(userRefreshRes.body.refreshToken).toBeUndefined();
    expect(userRefreshRes.body.refresh_token).toBeUndefined();

    // 2. Client Realm Login and Refresh
    const { account, plainPassword: clientPass } = await createTestClientAccount({
      email: "nobody.client@acme.local",
    });

    const clientLoginRes = await request(app)
      .post("/api/v1/client/auth/login")
      .send({
        tenantId: account.tenantId,
        email: account.email,
        password: clientPass,
      });

    expect(clientLoginRes.status).toBe(200);
    expect(clientLoginRes.body.refreshToken).toBeUndefined();
    expect(clientLoginRes.body.refresh_token).toBeUndefined();

    const clientCookies = clientLoginRes.headers["set-cookie"] as unknown as string[];
    const clientRefreshRes = await request(app)
      .post("/api/v1/client/auth/refresh")
      .set("Cookie", clientCookies);

    expect(clientRefreshRes.status).toBe(200);
    expect(clientRefreshRes.body.refreshToken).toBeUndefined();
    expect(clientRefreshRes.body.refresh_token).toBeUndefined();
  });
});
