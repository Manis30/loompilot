import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { createContainer } from "../../src/container.js";
import { ClientModel } from "../../src/models/identity/client.model.js";
import { createTestUser, generateTestAuthHeader } from "../helpers/auth-helper.js";

describe("Stage 3: Client Invitation & Activation Flow", () => {
  const container = createContainer();
  const app = createApp(container);
  const tenantId = "tenant_invite_flow_test";

  it("Executes the complete invitation, activation, and re-invitation workflow", async () => {
    // 1. Setup Admin and CRM Client
    const { user: admin } = await createTestUser({ tenantId, role: "admin", email: "inviter.admin@mill.local" });
    const adminHeader = generateTestAuthHeader({
      subjectId: String(admin._id),
      realm: "user",
      role: "admin",
      tenantId,
    });

    const clientDoc = await ClientModel.create({
      tenantId,
      clientName: "Saree Emporium Ltd",
      contactPerson: "Rajesh Saree",
      email: "billing@saree-emporium.local",
      phone: "+919876500001",
      city: "Varanasi",
      country: "India",
      address: "Chowk Bazaar, Godowlia",
      status: "active",
      paymentTermsDays: 30,
      version: 1,
    });

    const clientId = String(clientDoc._id);

    // 2. Admin invites client contact via /api/v1/clients/:id/portal/invite
    const inviteRes = await request(app)
      .post(`/api/v1/clients/${clientId}/portal/invite`)
      .set("Authorization", adminHeader)
      .send({
        email: "contact@saree-emporium.local",
        name: "Ramesh Kumar",
        phone: "+919876500000",
      });

    expect(inviteRes.status).toBe(201);
    expect(inviteRes.body.account.status).toBe("invited");
    expect(inviteRes.body.inviteToken).toBeDefined();
    expect(inviteRes.body.inviteLink).toContain(inviteRes.body.inviteToken);

    const inviteToken = inviteRes.body.inviteToken;

    // 3. Client accepts invitation and sets initial password
    const acceptRes = await request(app)
      .post("/api/v1/client/auth/accept-invite")
      .set("Idempotency-Key", `accept-${Date.now()}`)
      .send({
        token: inviteToken,
        password: "ClientSecurePassword123!",
      });

    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.success).toBe(true);

    // Verify client in DB is now active
    const activeClient = await ClientModel.findById(clientId).select("+portalAccess.passwordHash");
    expect(activeClient?.portalAccess?.status).toBe("active");
    expect(activeClient?.portalAccess?.passwordHash).toBeDefined();

    // 4. Client logs in with the newly set password
    const loginRes = await request(app)
      .post("/api/v1/client/auth/login")
      .send({
        tenantId,
        email: "contact@saree-emporium.local",
        password: "ClientSecurePassword123!",
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.accessToken).toBeDefined();
    expect(loginRes.body.clientAccount.id).toBe(clientId);

    // 5. Attempting to accept the invite again fails with 400 INVITE_ALREADY_ACCEPTED
    const repeatAcceptRes = await request(app)
      .post("/api/v1/client/auth/accept-invite")
      .set("Idempotency-Key", `repeat-${Date.now()}`)
      .send({
        token: inviteToken,
        password: "AnotherPassword123!",
      });

    expect(repeatAcceptRes.status).toBe(400);
    expect(repeatAcceptRes.body.error.code).toBe("INVITE_ALREADY_ACCEPTED");

    // 6. Admin locks client portal access via /api/v1/clients/:id/portal/lock
    const lockRes = await request(app)
      .post(`/api/v1/clients/${clientId}/portal/lock`)
      .set("Authorization", adminHeader)
      .send();
    expect(lockRes.status).toBe(200);
    expect(lockRes.body.status).toBe("locked");

    // Locked client cannot login
    const lockedLoginRes = await request(app)
      .post("/api/v1/client/auth/login")
      .send({
        tenantId,
        email: "contact@saree-emporium.local",
        password: "ClientSecurePassword123!",
      });
    expect(lockedLoginRes.status).toBe(403);
    expect(lockedLoginRes.body.error.code).toBe("ACCOUNT_LOCKED");

    // 7. Admin unlocks client portal access via /api/v1/clients/:id/portal/unlock
    const unlockRes = await request(app)
      .post(`/api/v1/clients/${clientId}/portal/unlock`)
      .set("Authorization", adminHeader)
      .send();
    expect(unlockRes.status).toBe(200);
    expect(unlockRes.body.status).toBe("active");

    // 8. Admin re-invites client account: resets status to invited and issues new token
    const reinviteRes = await request(app)
      .post(`/api/v1/clients/${clientId}/portal/re-invite`)
      .set("Authorization", adminHeader)
      .send();

    expect(reinviteRes.status).toBe(200);
    expect(reinviteRes.body.account.status).toBe("invited");
    expect(reinviteRes.body.inviteToken).toBeDefined();
    expect(reinviteRes.body.inviteToken).not.toBe(inviteToken);
  });
});
