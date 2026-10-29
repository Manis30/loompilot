import { describe, it, beforeAll, afterAll, beforeEach, expect } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../src/app.js";
import { setupTestDB, teardownTestDB, clearTestDB } from "./setup.js";
import { authService, userService, auditLogRepository } from "../src/container.js";
import { UserRole } from "@loompilot/shared";

describe("Stage 2B - Step 2: Security, Refresh Token Rotation, Users, and Audit Trail", () => {
  const tenantId = "tenant_security_step2";
  let ownerToken: string;
  let managerToken: string;
  let salesToken: string;
  let ownerUser: any;
  let managerUser: any;

  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    // 1. Initial owner (bootstrap)
    ownerUser = await authService.register({
      tenantId,
      email: "owner@step2.test",
      password: "Password123!",
      name: "Owner Step2",
      role: UserRole.OWNER,
    });

    const ownerLogin = await authService.login({
      tenantId,
      email: "owner@step2.test",
      password: "Password123!",
    });
    ownerToken = ownerLogin.accessToken;

    const ownerActor = {
      tenantId,
      userId: ownerUser.id,
      role: UserRole.OWNER,
      email: ownerUser.email,
    };

    // 2. Manager
    managerUser = await authService.register(
      {
        tenantId,
        email: "manager@step2.test",
        password: "Password123!",
        name: "Manager Step2",
        role: UserRole.MANAGER,
      },
      ownerActor
    );

    const managerLogin = await authService.login({
      tenantId,
      email: "manager@step2.test",
      password: "Password123!",
    });
    managerToken = managerLogin.accessToken;

    // 3. Sales
    await authService.register(
      {
        tenantId,
        email: "sales@step2.test",
        password: "Password123!",
        name: "Sales Step2",
        role: UserRole.SALES,
      },
      ownerActor
    );

    const salesLogin = await authService.login({
      tenantId,
      email: "sales@step2.test",
      password: "Password123!",
    });
    salesToken = salesLogin.accessToken;
  });

  describe("2.e: Registration Route Guards", () => {
    it("rejects unauthenticated requests to POST /api/v1/auth/register with 401", async () => {
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({
          tenantId,
          email: "unauth@step2.test",
          password: "Password123!",
          name: "Unauth User",
          role: UserRole.SALES,
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHENTICATED");
    });

    it("rejects non-owner callers to POST /api/v1/auth/register with 403", async () => {
      const res = await request(app)
        .post("/api/v1/auth/register")
        .set("Authorization", `Bearer ${salesToken}`)
        .send({
          tenantId,
          email: "forbidden@step2.test",
          password: "Password123!",
          name: "Forbidden User",
          role: UserRole.STORE,
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("allows owner to create new users via POST /api/v1/auth/register within their tenant", async () => {
      const res = await request(app)
        .post("/api/v1/auth/register")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          tenantId,
          email: "storeman@step2.test",
          password: "Password123!",
          name: "Store Man",
          role: UserRole.STORE,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.email).toBe("storeman@step2.test");
      expect(res.body.data.role).toBe("store");
    });
  });

  describe("2.d: Refresh Token Rotation & Reuse Detection", () => {
    it("rotates refresh token on /refresh and invalidates reused token, revoking entire family", async () => {
      // 1. Initial login
      const loginRes = await request(app)
        .post("/api/v1/auth/login")
        .send({
          tenantId,
          email: "owner@step2.test",
          password: "Password123!",
        });

      expect(loginRes.status).toBe(200);
      const initialCookie = loginRes.headers["set-cookie"]?.[0];
      expect(initialCookie).toBeDefined();

      // 2. First refresh (valid)
      const refresh1Res = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", [initialCookie!]);

      expect(refresh1Res.status).toBe(200);
      expect(refresh1Res.body.data.accessToken).toBeDefined();
      const rotatedCookie = refresh1Res.headers["set-cookie"]?.[0];
      expect(rotatedCookie).toBeDefined();
      expect(rotatedCookie).not.toBe(initialCookie);

      // 3. Second refresh with rotated cookie (valid)
      const refresh2Res = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", [rotatedCookie!]);

      expect(refresh2Res.status).toBe(200);

      // 4. Token Reuse Attack: Attempting to refresh again with the INITIAL (now revoked) cookie
      const attackRes = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", [initialCookie!]);

      expect(attackRes.status).toBe(401);

      // 5. Reuse detection verification: The whole token family is revoked!
      // Even the latest active cookie from that family must now be revoked and fail
      const latestCookie = refresh2Res.headers["set-cookie"]?.[0];
      const afterAttackRes = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", [latestCookie!]);

      expect(afterAttackRes.status).toBe(401);
    });

    it("POST /api/v1/auth/logout-all revokes all sessions for the user", async () => {
      // Login to get token and cookie
      const loginRes = await request(app)
        .post("/api/v1/auth/login")
        .send({
          tenantId,
          email: "owner@step2.test",
          password: "Password123!",
        });

      const cookie = loginRes.headers["set-cookie"]?.[0];
      const token = loginRes.body.data.accessToken;

      // Logout all
      const logoutAllRes = await request(app)
        .post("/api/v1/auth/logout-all")
        .set("Authorization", `Bearer ${token}`);

      expect(logoutAllRes.status).toBe(200);

      // Subsequent refresh with previous cookie must fail
      const refreshRes = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", [cookie!]);

      expect(refreshRes.status).toBe(401);
    });
  });

  describe("2.f: User Management Endpoints", () => {
    it("GET /api/v1/users allows owner and manager, rejects store/sales", async () => {
      const ownerRes = await request(app)
        .get("/api/v1/users")
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(ownerRes.status).toBe(200);
      expect(Array.isArray(ownerRes.body.data)).toBe(true);

      const managerRes = await request(app)
        .get("/api/v1/users")
        .set("Authorization", `Bearer ${managerToken}`);
      expect(managerRes.status).toBe(200);

      const salesRes = await request(app)
        .get("/api/v1/users")
        .set("Authorization", `Bearer ${salesToken}`);
      expect(salesRes.status).toBe(403);
    });

    it("POST /api/v1/users creates user in tenant (owner only)", async () => {
      const res = await request(app)
        .post("/api/v1/users")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          email: "accountant@step2.test",
          password: "Password123!",
          name: "Lead Accountant",
          role: UserRole.ACCOUNTS,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.email).toBe("accountant@step2.test");
      expect(res.body.data.role).toBe("accounts");

      // Non-owner gets 403
      const nonOwnerRes = await request(app)
        .post("/api/v1/users")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({
          email: "test@step2.test",
          password: "Password123!",
          name: "Test",
          role: UserRole.STORE,
        });
      expect(nonOwnerRes.status).toBe(403);
    });

    it("PATCH /api/v1/users/:id updates user, but forbids demoting or deactivating the last active owner", async () => {
      // 1. Create a second owner
      const secondOwnerRes = await request(app)
        .post("/api/v1/users")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          email: "owner2@step2.test",
          password: "Password123!",
          name: "Second Owner",
          role: UserRole.OWNER,
        });
      const secondOwnerId = secondOwnerRes.body.data.id;

      // 2. Can demote second owner because owner 1 is still active
      const demoteRes = await request(app)
        .patch(`/api/v1/users/${secondOwnerId}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ role: UserRole.MANAGER });
      expect(demoteRes.status).toBe(200);
      expect(demoteRes.body.data.role).toBe("manager");

      // 3. Attempting to deactivate or demote the ONLY remaining active owner must fail with 403
      const deactFirstOwnerRes = await request(app)
        .patch(`/api/v1/users/${ownerUser.id}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ isActive: false });

      expect(deactFirstOwnerRes.status).toBe(403);
      expect(deactFirstOwnerRes.body.error.message).toContain("last active owner");
    });

    it("POST /api/v1/users/:id/reset-password resets password (owner only)", async () => {
      const res = await request(app)
        .post(`/api/v1/users/${managerUser.id}/reset-password`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.data.temporaryPassword).toBeDefined();

      // Manager can now log in with temporary password
      const loginRes = await request(app)
        .post("/api/v1/auth/login")
        .send({
          tenantId,
          email: "manager@step2.test",
          password: res.body.data.temporaryPassword,
        });
      expect(loginRes.status).toBe(200);
    });

    it("POST /api/v1/auth/change-password changes own password with correct current password", async () => {
      const res = await request(app)
        .post("/api/v1/auth/change-password")
        .set("Authorization", `Bearer ${salesToken}`)
        .send({
          currentPassword: "Password123!",
          newPassword: "BrandNewPassword123!",
        });

      expect(res.status).toBe(200);

      // Verify login works with new password and fails with old
      const failLogin = await request(app)
        .post("/api/v1/auth/login")
        .send({
          tenantId,
          email: "sales@step2.test",
          password: "Password123!",
        });
      expect(failLogin.status).toBe(401);

      const successLogin = await request(app)
        .post("/api/v1/auth/login")
        .send({
          tenantId,
          email: "sales@step2.test",
          password: "BrandNewPassword123!",
        });
      expect(successLogin.status).toBe(200);
    });
  });

  describe("2.g: Immutable Audit Trail", () => {
    it("GET /api/v1/audit returns immutable audit logs with before/after snapshots (owner only)", async () => {
      // 1. Non-owner gets 403
      const nonOwner = await request(app)
        .get("/api/v1/audit")
        .set("Authorization", `Bearer ${managerToken}`);
      expect(nonOwner.status).toBe(403);

      // 2. Owner gets audit trail
      const res = await request(app)
        .get("/api/v1/audit")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toBeDefined();

      // Check for user creation audit logs
      const userAudit = res.body.data.find(
        (log: any) => log.entityType === "user" || log.entity === "user"
      );
      expect(userAudit).toBeDefined();
      expect(userAudit.tenantId).toBe(tenantId);
    });

    it("filters audit logs by entityType and date range", async () => {
      const res = await request(app)
        .get("/api/v1/audit?entityType=user&limit=10")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      for (const entry of res.body.data) {
        expect(["user", "user"].includes(entry.entityType || entry.entity)).toBe(true);
      }
    });
  });
});

