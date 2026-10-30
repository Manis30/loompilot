import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { createContainer } from "../../src/container.js";
import { UserModel } from "../../src/models/identity/user.model.js";
import { createTestUser, generateTestAuthHeader } from "../helpers/auth-helper.js";

describe("Stage 3: Last Active Administrator Protection", () => {
  const container = createContainer();
  const app = createApp(container);
  const tenantId = "tenant_last_admin_test";

  it("Refuses to lock the sole active administrator for a tenant (400 LAST_ADMIN)", async () => {
    // Ensure only 1 active admin exists for this tenant
    await UserModel.deleteMany({ tenantId });

    const { user: soleAdmin } = await createTestUser({
      tenantId,
      role: "admin",
      email: "sole.admin@mill.local",
    });

    const adminHeader = generateTestAuthHeader({
      subjectId: String(soleAdmin._id),
      realm: "user",
      role: "admin",
      tenantId,
    });

    // Attempt to lock
    const resLock = await request(app)
      .post(`/api/v1/users/${soleAdmin._id}/lock`)
      .set("Authorization", adminHeader)
      .send();

    expect(resLock.status).toBe(400);
    expect(resLock.body.error.code).toBe("LAST_ADMIN");
    expect(resLock.body.error.message).toContain("last active administrator");

    // Status remains active
    const dbAdmin = await UserModel.findById(soleAdmin._id);
    expect(dbAdmin?.status).toBe("active");
  });

  it("Refuses to demote the sole active administrator to supervisor (400 LAST_ADMIN)", async () => {
    await UserModel.deleteMany({ tenantId });

    const { user: soleAdmin } = await createTestUser({
      tenantId,
      role: "admin",
      email: "sole.admin2@mill.local",
    });

    const adminHeader = generateTestAuthHeader({
      subjectId: String(soleAdmin._id),
      realm: "user",
      role: "admin",
      tenantId,
    });

    // Attempt to demote
    const resDemote = await request(app)
      .patch(`/api/v1/users/${soleAdmin._id}`)
      .set("Authorization", adminHeader)
      .send({ role: "supervisor" });

    expect(resDemote.status).toBe(400);
    expect(resDemote.body.error.code).toBe("LAST_ADMIN");

    // Role remains admin
    const dbAdmin = await UserModel.findById(soleAdmin._id);
    expect(dbAdmin?.role).toBe("admin");
  });

  it("Allows locking or demoting an admin when another active admin exists for the tenant", async () => {
    await UserModel.deleteMany({ tenantId });

    const { user: adminOne } = await createTestUser({
      tenantId,
      role: "admin",
      email: "admin.one@mill.local",
    });

    const { user: adminTwo } = await createTestUser({
      tenantId,
      role: "admin",
      email: "admin.two@mill.local",
    });

    const adminOneHeader = generateTestAuthHeader({
      subjectId: String(adminOne._id),
      realm: "user",
      role: "admin",
      tenantId,
    });

    // AdminOne locks AdminTwo -> Succeeds because AdminOne is still active!
    const resLock = await request(app)
      .post(`/api/v1/users/${adminTwo._id}/lock`)
      .set("Authorization", adminOneHeader)
      .send();

    expect(resLock.status).toBe(200);
    expect(resLock.body.status).toBe("locked");

    const dbAdminTwo = await UserModel.findById(adminTwo._id);
    expect(dbAdminTwo?.status).toBe("locked");
  });
});

