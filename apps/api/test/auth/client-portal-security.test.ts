import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { createContainer } from "../../src/container.js";
import { ClientModel } from "../../src/models/identity/client.model.js";
import { AuditLogModel } from "../../src/models/platform/audit-log.model.js";
import { createTestUser, generateTestAuthHeader } from "../helpers/auth-helper.js";
import { StatusCacheService } from "../../src/services/status-cache.service.js";

describe("Stage 3.5 Step 3: Client Portal Security Invariants", () => {
  const container = createContainer();
  const app = createApp(container);
  const tenantId = "tenant_portal_security_test";

  it("Enforces portalAccess.passwordHash select: false and redaction across DTOs and audit logs", async () => {
    // 1. Setup admin
    const { user: admin } = await createTestUser({
      tenantId,
      role: "admin",
      email: "portal.admin@mill.local",
    });
    const adminHeader = generateTestAuthHeader({
      subjectId: String(admin._id),
      realm: "user",
      role: "admin",
      tenantId,
    });

    // 2. Create client doc
    const client = await ClientModel.create({
      tenantId,
      clientName: "Royal Silks",
      contactPerson: "Vijay Verma",
      email: "contact@royalsilks.local",
      city: "Kanchipuram",
      country: "India",
      address: "Temple Road",
      status: "active",
      paymentTermsDays: 15,
      version: 1,
    });
    const clientId = String(client._id);

    // 3. Admin invites client portal access
    const inviteRes = await request(app)
      .post(`/api/v1/clients/${clientId}/portal/invite`)
      .set("Authorization", adminHeader)
      .send({ email: "portal@royalsilks.local" });

    expect(inviteRes.status).toBe(201);
    expect(inviteRes.body.account.passwordHash).toBeUndefined();
    expect(inviteRes.body.account.portalAccess?.passwordHash).toBeUndefined();
    const inviteToken = inviteRes.body.inviteToken;

    // 4. Accept invite with secure password
    const plainPass = "SuperSecretPortalPass123!";
    const acceptRes = await request(app)
      .post("/api/v1/client/auth/accept-invite")
      .set("Idempotency-Key", `idemp-sec-${Date.now()}`)
      .send({ token: inviteToken, password: plainPass });

    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.account.passwordHash).toBeUndefined();

    // 5. Verify select: false invariant on direct Mongoose queries
    const defaultQuery = await ClientModel.findById(clientId).lean();
    expect(defaultQuery?.portalAccess?.passwordHash).toBeUndefined();

    const explicitlySelected = await ClientModel.findById(clientId)
      .select("+portalAccess.passwordHash")
      .lean();
    expect(explicitlySelected?.portalAccess?.passwordHash).toBeDefined();

    // 6. Client login: DTO has NO passwordHash and refresh token is cookie-only
    const loginRes = await request(app)
      .post("/api/v1/client/auth/login")
      .send({
        tenantId,
        email: "portal@royalsilks.local",
        password: plainPass,
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.refreshToken).toBeUndefined();
    expect(loginRes.body.clientAccount.passwordHash).toBeUndefined();
    expect(loginRes.headers["set-cookie"]).toBeDefined();

    const clientHeader = `Bearer ${loginRes.body.accessToken}`;

    // 7. Verify /api/v1/me response never returns passwordHash
    const meRes = await request(app)
      .get("/api/v1/me")
      .set("Authorization", clientHeader);

    expect(meRes.status).toBe(200);
    expect(meRes.body.profile.passwordHash).toBeUndefined();
    expect(meRes.body.profile.portalAccess?.passwordHash).toBeUndefined();

    // 8. Verify audit logs never record passwordHash in before / after / payload
    const auditLogs = await AuditLogModel.find({
      tenantId,
      "entity.collection": "clients",
    }).lean();

    expect(auditLogs.length).toBeGreaterThan(0);
    for (const log of auditLogs) {
      const serialized = JSON.stringify(log);
      expect(serialized).not.toContain(plainPass);
      expect((log.before as any)?.passwordHash).toBeUndefined();
      expect((log.before as any)?.portalAccess?.passwordHash).toBeUndefined();
      expect((log.after as any)?.passwordHash).toBeUndefined();
      expect((log.after as any)?.portalAccess?.passwordHash).toBeUndefined();
    }
  });

  it("Purges client realm status-cache key on lock, unlock, re-invite, and password change, immediately rejecting active access tokens on lock", async () => {
    // 1. Setup Admin and Client
    const { user: admin } = await createTestUser({ tenantId, role: "admin" });
    const adminHeader = generateTestAuthHeader({
      subjectId: String(admin._id),
      realm: "user",
      role: "admin",
      tenantId,
    });

    const client = await ClientModel.create({
      tenantId,
      clientName: "Cache Test Weaving",
      email: "cache@weaving.local",
      city: "Madurai",
      country: "India",
      status: "active",
      paymentTermsDays: 30,
      version: 1,
    });
    const clientId = String(client._id);

    // Invite and accept
    const inviteRes = await request(app)
      .post(`/api/v1/clients/${clientId}/portal/invite`)
      .set("Authorization", adminHeader)
      .send({ email: "portal@cache-weaving.local" });
    const inviteToken = inviteRes.body.inviteToken;

    const password = "InitialCachePass123!";
    await request(app)
      .post("/api/v1/client/auth/accept-invite")
      .set("Idempotency-Key", `cache-accept-${Date.now()}`)
      .send({ token: inviteToken, password });

    // Client logs in
    const loginRes = await request(app)
      .post("/api/v1/client/auth/login")
      .send({ tenantId, email: "portal@cache-weaving.local", password });
    expect(loginRes.status).toBe(200);
    const clientAccessToken = loginRes.body.accessToken;
    const clientAuthHeader = `Bearer ${clientAccessToken}`;

    // Active client calls /api/v1/me -> 200 OK
    const meResBefore = await request(app)
      .get("/api/v1/me")
      .set("Authorization", clientAuthHeader);
    expect(meResBefore.status).toBe(200);

    // Verify status cache holds active
    const cachedStatus = await StatusCacheService.getStatus("client", tenantId, clientId);
    expect(cachedStatus).toBe("active");

    // Admin locks client portal
    const lockRes = await request(app)
      .post(`/api/v1/clients/${clientId}/portal/lock`)
      .set("Authorization", adminHeader)
      .send();
    expect(lockRes.status).toBe(200);

    // Test: within the SAME test, previously active access token is REJECTED immediately!
    const meResLocked = await request(app)
      .get("/api/v1/me")
      .set("Authorization", clientAuthHeader);
    expect(meResLocked.status).toBe(403);
    expect(meResLocked.body.error.code).toBe("ACCOUNT_LOCKED");

    // Admin unlocks client portal
    const unlockRes = await request(app)
      .post(`/api/v1/clients/${clientId}/portal/unlock`)
      .set("Authorization", adminHeader)
      .send();
    expect(unlockRes.status).toBe(200);

    // Verify cache restored to active on unlock
    const cachedAfterUnlock = await StatusCacheService.getStatus("client", tenantId, clientId);
    expect(cachedAfterUnlock).toBe("active");

    // Admin re-invites client portal
    const reinviteRes = await request(app)
      .post(`/api/v1/clients/${clientId}/portal/re-invite`)
      .set("Authorization", adminHeader)
      .send();
    expect(reinviteRes.status).toBe(200);

    // Verify cache was purged on re-invite
    const cachedAfterReinvite = await StatusCacheService.getStatus("client", tenantId, clientId);
    expect(cachedAfterReinvite).toBeNull();

    // Accept reinvite and login again
    const reinviteToken = reinviteRes.body.inviteToken;
    const newPass = "NewCachePass123!";
    await request(app)
      .post("/api/v1/client/auth/accept-invite")
      .set("Idempotency-Key", `re-acc-${Date.now()}`)
      .send({ token: reinviteToken, password: newPass });

    const loginRes2 = await request(app)
      .post("/api/v1/client/auth/login")
      .send({ tenantId, email: "portal@cache-weaving.local", password: newPass });
    expect(loginRes2.status).toBe(200);
    const token2 = loginRes2.body.accessToken;

    // Cache active again
    await request(app).get("/api/v1/me").set("Authorization", `Bearer ${token2}`);
    expect(await StatusCacheService.getStatus("client", tenantId, clientId)).toBe("active");

    // Client changes password
    const changePassRes = await request(app)
      .post("/api/v1/auth/change-password")
      .set("Authorization", `Bearer ${token2}`)
      .send({ currentPassword: newPass, newPassword: "UpdatedCachePass456!" });
    expect(changePassRes.status).toBe(200);

    // Verify cache was purged on password change
    const cachedAfterPasswordChange = await StatusCacheService.getStatus("client", tenantId, clientId);
    expect(cachedAfterPasswordChange).toBeNull();
  });

  it("Verifies invite endpoint response shape and confirms invite token never appears in audit logs or before/after", async () => {
    const { user: admin } = await createTestUser({ tenantId, role: "admin" });
    const adminHeader = generateTestAuthHeader({
      subjectId: String(admin._id),
      realm: "user",
      role: "admin",
      tenantId,
    });

    const client = await ClientModel.create({
      tenantId,
      clientName: "Audit Token Redaction Mill",
      email: "audit@redaction.local",
      city: "Tirupur",
      country: "India",
      status: "active",
      paymentTermsDays: 30,
      version: 1,
    });
    const clientId = String(client._id);

    // Admin invites client
    const inviteRes = await request(app)
      .post(`/api/v1/clients/${clientId}/portal/invite`)
      .set("Authorization", adminHeader)
      .send({
        email: "contact@redaction.local",
        name: "Audit Contact",
        phone: "+919876543210",
      });

    expect(inviteRes.status).toBe(201);
    expect(inviteRes.body).toHaveProperty("account");
    expect(inviteRes.body).toHaveProperty("inviteToken");
    expect(inviteRes.body).toHaveProperty("inviteLink");
    expect(inviteRes.body.account.email).toBe("contact@redaction.local");
    expect(inviteRes.body.account.status).toBe("invited");
    expect(inviteRes.body.account.passwordHash).toBeUndefined();

    const inviteToken = inviteRes.body.inviteToken;
    expect(typeof inviteToken).toBe("string");
    expect(inviteToken.length).toBeGreaterThan(20);

    // Inspect AuditLog entry for CLIENT_PORTAL_INVITED
    const inviteAudit = await AuditLogModel.findOne({
      tenantId,
      action: "CLIENT_PORTAL_INVITED",
      "entity.id": clientId,
    }).lean();

    expect(inviteAudit).toBeDefined();
    // Audit before/after must never hold inviteToken or passwordHash
    expect((inviteAudit?.before as any)?.inviteToken).toBeUndefined();
    expect((inviteAudit?.after as any)?.inviteToken).toBeUndefined();
    expect((inviteAudit?.after as any)?.passwordHash).toBeUndefined();

    // Full JSON stringification of the entire audit record must NEVER contain the raw token
    const fullAuditString = JSON.stringify(inviteAudit);
    expect(fullAuditString).not.toContain(inviteToken);
  });
});
