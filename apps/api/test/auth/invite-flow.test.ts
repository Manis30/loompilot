import { describe, it, expect } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { createApp } from "../../src/app.js";
import { createContainer } from "../../src/container.js";
import { ClientAccountModel } from "../../src/models/identity/client-account.model.js";
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

    // 2. Admin invites client contact
    const inviteRes = await request(app)
      .post("/api/v1/client-accounts/invite")
      .set("Authorization", adminHeader)
      .send({
        clientId: String(clientDoc._id),
        email: "contact@saree-emporium.local",
        name: "Ramesh Kumar",
        phone: "+919876500000",
      });

    expect(inviteRes.status).toBe(201);
    expect(inviteRes.body.account.status).toBe("invited");
    expect(inviteRes.body.inviteToken).toBeDefined();
    expect(inviteRes.body.inviteLink).toContain(inviteRes.body.inviteToken);

    const accountId = inviteRes.body.account._id;
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

    // Verify account in DB is now active
    const activeAccount = await ClientAccountModel.findById(accountId);
    expect(activeAccount?.status).toBe("active");
    expect(activeAccount?.passwordHash).toBeDefined();

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
    expect(loginRes.body.clientAccount.id).toBe(String(accountId));

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

    // 6. Admin re-invites client account: resets status to invited and issues new token
    const reinviteRes = await request(app)
      .post(`/api/v1/client-accounts/${accountId}/reinvite`)
      .set("Authorization", adminHeader)
      .send();

    expect(reinviteRes.status).toBe(200);
    expect(reinviteRes.body.account.status).toBe("invited");
    expect(reinviteRes.body.inviteToken).toBeDefined();
    expect(reinviteRes.body.inviteToken).not.toBe(inviteToken);
  });
});
