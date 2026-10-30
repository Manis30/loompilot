import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { createContainer } from "../../src/container.js";
import { UserModel } from "../../src/models/identity/user.model.js";
import { createTestUser, generateTestAuthHeader } from "../helpers/auth-helper.js";

describe("Stage 3: Multi-Tenancy Isolation", () => {
  const container = createContainer();
  const app = createApp(container);

  const tenantAlpha = "tenant_alpha_real";
  const tenantBeta = "tenant_beta_attacker";

  it("Enforces tenantId strictly from JWT token, ignoring query parameters, body parameters, and headers", async () => {
    // 1. Create an admin in tenantAlpha
    const { user: adminAlpha } = await createTestUser({
      tenantId: tenantAlpha,
      role: "admin",
      email: "alpha.admin@loompilot.local",
    });

    // 2. Create a supervisor in tenantBeta
    await createTestUser({
      tenantId: tenantBeta,
      role: "supervisor",
      email: "beta.supervisor@loompilot.local",
    });

    const alphaAuthHeader = generateTestAuthHeader({
      subjectId: String(adminAlpha._id),
      realm: "user",
      role: "admin",
      tenantId: tenantAlpha,
    });

    // 3. Attempt to query users belonging to tenantBeta via query param and header spoofing
    const resList = await request(app)
      .get("/api/v1/users?tenantId=tenant_beta_attacker")
      .set("Authorization", alphaAuthHeader)
      .set("X-Tenant-Id", tenantBeta);

    expect(resList.status).toBe(200);
    // Should ONLY contain tenantAlpha users, never tenantBeta users
    expect(resList.body.items.length).toBeGreaterThanOrEqual(1);
    for (const item of resList.body.items) {
      expect(item.tenantId).toBe(tenantAlpha);
      expect(item.tenantId).not.toBe(tenantBeta);
    }

    // 4. Attempt to create a user with a spoofed body.tenantId = tenantBeta
    const resCreate = await request(app)
      .post("/api/v1/users")
      .set("Authorization", alphaAuthHeader)
      .set("X-Tenant-Id", tenantBeta)
      .send({
        tenantId: tenantBeta, // Spoofed tenantId
        email: "spoofed.creation@mill.local",
        name: "Spoofed User",
        password: "ValidSecret123!",
        role: "supervisor",
        processAreas: ["winding"],
      });

    expect(resCreate.status).toBe(201);
    // Verified that DB document was created under tenantAlpha!
    const createdUser = await UserModel.findOne({ email: "spoofed.creation@mill.local" });
    expect(createdUser).toBeDefined();
    expect(createdUser?.tenantId).toBe(tenantAlpha);
    expect(createdUser?.tenantId).not.toBe(tenantBeta);
  });
});

