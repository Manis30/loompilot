import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { createContainer } from "../../src/container.js";
import { ClientModel } from "../../src/models/identity/client.model.js";
import { AuditLogModel } from "../../src/models/platform/audit-log.model.js";
import { createTestUser, generateTestAuthHeader } from "../helpers/auth-helper.js";

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
});
