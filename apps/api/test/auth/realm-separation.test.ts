import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { createContainer } from "../../src/container.js";
import { createTestUser, createTestClientAccount, generateTestAuthHeader } from "../helpers/auth-helper.js";

describe("Stage 3: Realm Separation (user vs client)", () => {
  const container = createContainer();
  const app = createApp(container);

  it("Rejects User realm token on Client routes with 403 FORBIDDEN", async () => {
    const { user } = await createTestUser({ role: "admin" });
    const userAuthHeader = generateTestAuthHeader({
      subjectId: String(user._id),
      realm: "user",
      role: "admin",
      tenantId: user.tenantId,
    });

    // Attempt to access client-only route
    const res = await request(app)
      .post("/api/v1/client/auth/logout-all")
      .set("Authorization", userAuthHeader)
      .send();

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
    expect(res.body.error.message).toContain("Realm 'user' is not authorized");
  });

  it("Rejects Client realm token on User routes with 403 FORBIDDEN", async () => {
    const { account } = await createTestClientAccount();
    const clientAuthHeader = generateTestAuthHeader({
      subjectId: String(account._id),
      realm: "client",
      tenantId: account.tenantId,
      clientId: String(account.clientId),
    });

    // 1. Attempt to access staff user management
    const resUsers = await request(app)
      .get("/api/v1/users")
      .set("Authorization", clientAuthHeader);

    expect(resUsers.status).toBe(403);
    expect(resUsers.body.error.code).toBe("FORBIDDEN");
    expect(resUsers.body.error.message).toContain("Realm 'client' is not authorized");

    // 2. Attempt to access audit logs
    const resAudit = await request(app)
      .get("/api/v1/audit")
      .set("Authorization", clientAuthHeader);

    expect(resAudit.status).toBe(403);
    expect(resAudit.body.error.code).toBe("FORBIDDEN");
  });

  it("Allows both realms to access shared self-service /api/v1/me correctly", async () => {
    const { user } = await createTestUser({ role: "admin", email: "me.user@mill.local" });
    const { account } = await createTestClientAccount({ email: "me.client@acme.local" });

    const userHeader = generateTestAuthHeader({
      subjectId: String(user._id),
      realm: "user",
      role: "admin",
      tenantId: user.tenantId,
    });

    const clientHeader = generateTestAuthHeader({
      subjectId: String(account._id),
      realm: "client",
      tenantId: account.tenantId,
      clientId: String(account.clientId),
    });

    // Staff access /me
    const resUser = await request(app).get("/api/v1/me").set("Authorization", userHeader);
    expect(resUser.status).toBe(200);
    expect(resUser.body.realm).toBe("user");
    expect(resUser.body.profile.email).toBe(user.email);

    // Client access /me
    const resClient = await request(app).get("/api/v1/me").set("Authorization", clientHeader);
    expect(resClient.status).toBe(200);
    expect(resClient.body.realm).toBe("client");
    expect(resClient.body.profile.email).toBe(account.email);
  });
});

