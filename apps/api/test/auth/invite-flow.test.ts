import { describe, it, expect } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { createApp } from "../../src/app.js";
import { createContainer } from "../../src/container.js";
import { ClientModel } from "../../src/models/identity/client.model.js";
import { createTestUser, generateTestAuthHeader } from "../helpers/auth-helper.js";
import { getEnv } from "../../src/config/env.js";

describe("Stage 3: Client Invitation & Activation Flow", () => {
  const container = createContainer();
  const app = createApp(container);
  const tenantId = "tenant_invite_flow_test";

  it("Executes the complete invitation, activation, and login workflow", async () => {
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
  });

  it("Re-invite invalidates and kills the previous invitation token", async () => {
    const { user: admin } = await createTestUser({ tenantId, role: "admin" });
    const adminHeader = generateTestAuthHeader({
      subjectId: String(admin._id),
      realm: "user",
      role: "admin",
      tenantId,
    });

    const client = await ClientModel.create({
      tenantId,
      clientName: "Silks & Sarees",
      email: "silks@test.local",
      city: "Surat",
      country: "India",
      status: "active",
      paymentTermsDays: 30,
      version: 1,
    });
    const clientId = String(client._id);

    // 1. Initial invite
    const invite1 = await request(app)
      .post(`/api/v1/clients/${clientId}/portal/invite`)
      .set("Authorization", adminHeader)
      .send({ email: "portal1@silks.local" });
    expect(invite1.status).toBe(201);
    const token1 = invite1.body.inviteToken;

    // Wait 15ms to ensure epoch ms increments on reinvite
    await new Promise((r) => setTimeout(r, 15));

    // 2. Admin re-invites
    const reinvite = await request(app)
      .post(`/api/v1/clients/${clientId}/portal/re-invite`)
      .set("Authorization", adminHeader)
      .send();
    expect(reinvite.status).toBe(200);
    const token2 = reinvite.body.inviteToken;
    expect(token2).not.toBe(token1);

    // 3. Attempting to accept with old token1 is rejected with 400 INVITE_EXPIRED
    const failAccept = await request(app)
      .post("/api/v1/client/auth/accept-invite")
      .set("Idempotency-Key", `fail-reinvite-${Date.now()}`)
      .send({ token: token1, password: "ValidPassword123!" });
    expect(failAccept.status).toBe(400);
    expect(failAccept.body.error.code).toBe("INVITE_EXPIRED");

    // 4. Accepting with the new token2 succeeds
    const successAccept = await request(app)
      .post("/api/v1/client/auth/accept-invite")
      .set("Idempotency-Key", `succ-reinvite-${Date.now()}`)
      .send({ token: token2, password: "ValidPassword123!" });
    expect(successAccept.status).toBe(200);
    expect(successAccept.body.success).toBe(true);
  });

  it("Accepting an invitation twice is rejected with INVITE_ALREADY_ACCEPTED", async () => {
    const { user: admin } = await createTestUser({ tenantId, role: "admin" });
    const adminHeader = generateTestAuthHeader({
      subjectId: String(admin._id),
      realm: "user",
      role: "admin",
      tenantId,
    });

    const client = await ClientModel.create({
      tenantId,
      clientName: "Double Accept Mill",
      email: "double@test.local",
      city: "Erode",
      country: "India",
      status: "active",
      paymentTermsDays: 30,
      version: 1,
    });
    const clientId = String(client._id);

    const invite = await request(app)
      .post(`/api/v1/clients/${clientId}/portal/invite`)
      .set("Authorization", adminHeader)
      .send({ email: "double@portal.local" });
    const token = invite.body.inviteToken;

    // First accept: 200 OK
    const firstRes = await request(app)
      .post("/api/v1/client/auth/accept-invite")
      .set("Idempotency-Key", `double-1-${Date.now()}`)
      .send({ token, password: "ValidPassword123!" });
    expect(firstRes.status).toBe(200);

    // Second accept with different idempotency key: 400 INVITE_ALREADY_ACCEPTED
    const secondRes = await request(app)
      .post("/api/v1/client/auth/accept-invite")
      .set("Idempotency-Key", `double-2-${Date.now()}`)
      .send({ token, password: "AnotherValidPass123!" });
    expect(secondRes.status).toBe(400);
    expect(secondRes.body.error.code).toBe("INVITE_ALREADY_ACCEPTED");
  });

  it("Expired invitation token is rejected with INVITE_EXPIRED", async () => {
    const env = getEnv();
    const expiredToken = jwt.sign(
      {
        sub: "client_dummy_id",
        purpose: "invite",
        tenantId,
        invitedAtMs: Date.now() - 1000000,
        jti: "expired-jti-123",
      },
      env.JWT_ACCESS_SECRET,
      {
        algorithm: "HS256",
        expiresIn: "-1s", // Expired immediately
        issuer: "loompilot-api",
      }
    );

    const res = await request(app)
      .post("/api/v1/client/auth/accept-invite")
      .set("Idempotency-Key", `expired-${Date.now()}`)
      .send({ token: expiredToken, password: "ValidPassword123!" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVITE_EXPIRED");
  });

  it("Invitation token with wrong purpose or wrong tenant is rejected", async () => {
    const env = getEnv();

    // 1. Wrong purpose (e.g. "access" instead of "invite")
    const wrongPurposeToken = jwt.sign(
      {
        sub: "client_dummy_id",
        purpose: "access",
        tenantId,
        invitedAtMs: Date.now(),
        jti: "wrong-purpose-jti",
      },
      env.JWT_ACCESS_SECRET,
      { algorithm: "HS256", expiresIn: "1h", issuer: "loompilot-api" }
    );

    const wrongPurposeRes = await request(app)
      .post("/api/v1/client/auth/accept-invite")
      .set("Idempotency-Key", `wrong-purpose-${Date.now()}`)
      .send({ token: wrongPurposeToken, password: "ValidPassword123!" });
    expect(wrongPurposeRes.status).toBe(400);
    expect(wrongPurposeRes.body.error.code).toBe("VALIDATION_FAILED");

    // 2. Wrong tenant
    const wrongTenantToken = jwt.sign(
      {
        sub: "client_dummy_id",
        purpose: "invite",
        tenantId: "tenant_other_unauthorized",
        invitedAtMs: Date.now(),
        jti: "wrong-tenant-jti",
      },
      env.JWT_ACCESS_SECRET,
      { algorithm: "HS256", expiresIn: "1h", issuer: "loompilot-api" }
    );

    const wrongTenantRes = await request(app)
      .post("/api/v1/client/auth/accept-invite")
      .set("Idempotency-Key", `wrong-tenant-${Date.now()}`)
      .send({
        token: wrongTenantToken,
        tenantId: "tenant_invite_flow_test", // Mismatch with token
        password: "ValidPassword123!",
      });
    expect(wrongTenantRes.status).toBe(403);
    expect(wrongTenantRes.body.error.code).toBe("FORBIDDEN");
  });

  it("A locked account cannot accept invitations (403 ACCOUNT_LOCKED)", async () => {
    const { user: admin } = await createTestUser({ tenantId, role: "admin" });
    const adminHeader = generateTestAuthHeader({
      subjectId: String(admin._id),
      realm: "user",
      role: "admin",
      tenantId,
    });

    const client = await ClientModel.create({
      tenantId,
      clientName: "Locked Client Textiles",
      email: "locked@test.local",
      city: "Salem",
      country: "India",
      status: "active",
      paymentTermsDays: 30,
      version: 1,
    });
    const clientId = String(client._id);

    // 1. Invite client
    const inviteRes = await request(app)
      .post(`/api/v1/clients/${clientId}/portal/invite`)
      .set("Authorization", adminHeader)
      .send({ email: "locked_portal@test.local" });
    const token = inviteRes.body.inviteToken;

    // 2. Admin locks client portal
    const lockRes = await request(app)
      .post(`/api/v1/clients/${clientId}/portal/lock`)
      .set("Authorization", adminHeader)
      .send();
    expect(lockRes.status).toBe(200);

    // 3. Client attempts to accept invite on locked account -> 403 ACCOUNT_LOCKED
    const acceptRes = await request(app)
      .post("/api/v1/client/auth/accept-invite")
      .set("Idempotency-Key", `locked-accept-${Date.now()}`)
      .send({ token, password: "ValidPassword123!" });
    expect(acceptRes.status).toBe(403);
    expect(acceptRes.body.error.code).toBe("ACCOUNT_LOCKED");
  });

  it("A duplicate portalAccess.email returns a DUPLICATE error (409)", async () => {
    const { user: admin } = await createTestUser({ tenantId, role: "admin" });
    const adminHeader = generateTestAuthHeader({
      subjectId: String(admin._id),
      realm: "user",
      role: "admin",
      tenantId,
    });

    const client1 = await ClientModel.create({
      tenantId,
      clientName: "Mill One",
      email: "m1@test.local",
      city: "Coimbatore",
      country: "India",
      status: "active",
      paymentTermsDays: 30,
      version: 1,
    });
    const client2 = await ClientModel.create({
      tenantId,
      clientName: "Mill Two",
      email: "m2@test.local",
      city: "Tiruppur",
      country: "India",
      status: "active",
      paymentTermsDays: 30,
      version: 1,
    });

    const sharedPortalEmail = "contact.shared@textiles.local";

    // Invite client1 with email
    const invite1 = await request(app)
      .post(`/api/v1/clients/${client1._id}/portal/invite`)
      .set("Authorization", adminHeader)
      .send({ email: sharedPortalEmail });
    expect(invite1.status).toBe(201);

    // Attempt to invite client2 with the same portal email -> 409 DUPLICATE
    const invite2 = await request(app)
      .post(`/api/v1/clients/${client2._id}/portal/invite`)
      .set("Authorization", adminHeader)
      .send({ email: sharedPortalEmail });
    expect(invite2.status).toBe(409);
    expect(invite2.body.error.code).toBe("DUPLICATE");
  });
});
