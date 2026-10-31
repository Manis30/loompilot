import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { createContainer } from "../../src/container.js";
import { UserModel } from "../../src/models/identity/user.model.js";
import { ClientModel } from "../../src/models/identity/client.model.js";
import { createTestUser, createTestClientAccount, generateTestAuthHeader } from "../helpers/auth-helper.js";

describe("Stage 3: Authentication & Login Flow", () => {
  const container = createContainer();
  const app = createApp(container);

  it("Staff login succeeds with valid credentials and sets secure refresh cookie", async () => {
    const { user, plainPassword } = await createTestUser({ email: "staff.login@loompilot.local" });

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({
        tenantId: user.tenantId,
        email: user.email,
        password: plainPassword,
      });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.expiresIn).toBeDefined();
    expect(res.body.user.email).toBe(user.email);
    expect(res.body.user.role).toBe(user.role);
    expect(res.body.user.passwordHash).toBeUndefined();

    // Verify Set-Cookie header contains refresh_token
    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
    const cookieString = Array.isArray(cookies) ? cookies.join(";") : String(cookies);
    expect(cookieString).toContain("refreshToken=");
    expect(cookieString).toContain("HttpOnly");
  });

  it("Client login succeeds with valid credentials", async () => {
    const { account, plainPassword } = await createTestClientAccount({ email: "client.login@acme.local" });

    const res = await request(app)
      .post("/api/v1/client/auth/login")
      .send({
        tenantId: account.tenantId,
        email: account.email,
        password: plainPassword,
      });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.clientAccount.email).toBe(account.email);
    expect(res.body.clientAccount.clientId).toBe(String(account.clientId));
    expect(res.body.clientAccount.passwordHash).toBeUndefined();
  });

  it("Returns identical generic error message for invalid email vs wrong password (no enumeration)", async () => {
    const { user } = await createTestUser();

    // 1. Existing user, wrong password
    const resWrongPass = await request(app)
      .post("/api/v1/auth/login")
      .send({
        tenantId: user.tenantId,
        email: user.email,
        password: "IncorrectPassword123!",
      });

    // 2. Non-existent user
    const resNoUser = await request(app)
      .post("/api/v1/auth/login")
      .send({
        tenantId: user.tenantId,
        email: "non.existent.user@random.local",
        password: "IncorrectPassword123!",
      });

    expect(resWrongPass.status).toBe(401);
    expect(resNoUser.status).toBe(401);
    expect(resWrongPass.body.error.message).toBe("Invalid email or password");
    expect(resNoUser.body.error.message).toBe("Invalid email or password");
    expect(resWrongPass.body.error.code).toBe(resNoUser.body.error.code);
  });

  it("Enforces account lockout after 5 failed attempts for 15 minutes", async () => {
    const { user } = await createTestUser({ email: "lockout.test@mill.local" });

    // 5 consecutive failed attempts
    for (let i = 1; i <= 5; i++) {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          tenantId: user.tenantId,
          email: user.email,
          password: "WrongPassword999!",
        });
      expect(res.status).toBe(401);
    }

    // 6th attempt: Account is locked (403)
    const resLocked = await request(app)
      .post("/api/v1/auth/login")
      .send({
        tenantId: user.tenantId,
        email: user.email,
        password: "WrongPassword999!",
      });

    expect(resLocked.status).toBe(403);
    expect(resLocked.body.error.code).toBe("ACCOUNT_LOCKED");

    // Check DB state
    const dbUser = await UserModel.findById(user._id);
    expect(dbUser?.status).toBe("locked");
    expect(dbUser?.lockout?.failedCount).toBe(5);
    expect(dbUser?.lockout?.lockedUntil).toBeDefined();
  });

  it("Automatically unlocks when lockout duration has elapsed", async () => {
    const { user, plainPassword } = await createTestUser({ email: "auto.unlock@mill.local" });

    // Manually set lockedUntil in the past
    await UserModel.updateOne(
      { _id: user._id },
      {
        $set: {
          status: "locked",
          "lockout.failedCount": 5,
          "lockout.lockedUntil": new Date(Date.now() - 60000), // 1 minute ago
        },
      }
    );

    // Logging in with valid credentials succeeds and resets lockout
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({
        tenantId: user.tenantId,
        email: user.email,
        password: plainPassword,
      });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();

    const dbUser = await UserModel.findById(user._id);
    expect(dbUser?.status).toBe("active");
    expect(dbUser?.lockout?.failedCount).toBe(0);
    expect(dbUser?.lockout?.lockedUntil).toBeNull();
  });

  it("Administrator can manually unlock a locked user via POST /api/v1/users/:id/unlock", async () => {
    const { user: admin } = await createTestUser({ role: "admin", email: "admin.unlocker@mill.local" });
    const { user: target, plainPassword: targetPassword } = await createTestUser({
      role: "supervisor",
      email: "supervisor.locked@mill.local",
      status: "locked",
    });

    const adminAuthHeader = generateTestAuthHeader({
      subjectId: String(admin._id),
      realm: "user",
      role: "admin",
      tenantId: admin.tenantId,
    });

    // Admin unlocks user
    const unlockRes = await request(app)
      .post(`/api/v1/users/${target._id}/unlock`)
      .set("Authorization", adminAuthHeader)
      .send();

    expect(unlockRes.status).toBe(200);
    expect(unlockRes.body.status).toBe("active");

    // Unlocked user can now log in
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({
        tenantId: target.tenantId,
        email: target.email,
        password: targetPassword,
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.accessToken).toBeDefined();
  });

  it("Enforces client portal account lockout after 5 failed attempts for 15 minutes", async () => {
    const { account } = await createTestClientAccount({
      email: "client.lockout@acme.local",
    });

    // 5 consecutive failed attempts on client login
    for (let i = 1; i <= 5; i++) {
      const res = await request(app)
        .post("/api/v1/client/auth/login")
        .send({
          tenantId: account.tenantId,
          email: account.email,
          password: "WrongClientPassword999!",
        });
      expect(res.status).toBe(401);
    }

    // 6th attempt: Client portal account is locked (403)
    const resLocked = await request(app)
      .post("/api/v1/client/auth/login")
      .send({
        tenantId: account.tenantId,
        email: account.email,
        password: "WrongClientPassword999!",
      });

    expect(resLocked.status).toBe(403);
    expect(resLocked.body.error.code).toBe("ACCOUNT_LOCKED");

    // Verify DB client portalAccess state
    const dbClient = await ClientModel.findById(account.clientId);
    expect(dbClient?.portalAccess?.status).toBe("locked");
    expect(dbClient?.portalAccess?.lockout?.failedCount).toBe(5);
    expect(dbClient?.portalAccess?.lockout?.lockedUntil).toBeDefined();
  });
});

