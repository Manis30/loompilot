import { describe, it, expect, vi } from "vitest";
import { createAdmin } from "../../src/scripts/create-admin.js";
import { UserModel } from "../../src/models/identity/user.model.js";
import { SettingsModel } from "../../src/models/identity/settings.model.js";

describe("Stage 3: create-admin Provisioning CLI", () => {
  const tenantId = "tenant_cli_admin_test";

  it("Provisions the initial administrator, creates default settings, and refuses duplicates without --force", async () => {
    await UserModel.deleteMany({ tenantId });
    await SettingsModel.deleteMany({ tenantId });

    // 1. Initial admin creation
    const res = await createAdmin({
      tenantId,
      email: "initial.admin@mill.local",
      name: "Initial Admin",
      password: "StrongPassword123!",
    });

    expect(res.userId).toBeDefined();
    expect(res.email).toBe("initial.admin@mill.local");
    expect(res.tenantId).toBe(tenantId);

    // Verify User in MongoDB
    const user = await UserModel.findById(res.userId);
    expect(user).toBeDefined();
    expect(user?.role).toBe("admin");
    expect(user?.status).toBe("active");
    expect(user?.processAreas).toEqual(["winding", "warping", "weaving"]);

    // Verify default Settings created in MongoDB
    const settings = await SettingsModel.findOne({ tenantId });
    expect(settings).toBeDefined();
    expect(settings?.timezone).toBe("Asia/Kolkata");
    expect(settings?.minMarginPct).toBe(12);
    expect(settings?.weeklyOffs).toEqual([0]);

    // 2. Refuses duplicate admin creation without force
    await expect(
      createAdmin({
        tenantId,
        email: "duplicate.admin@mill.local",
        password: "StrongPassword123!",
        force: false,
      })
    ).rejects.toThrow("An active administrator already exists");

    // 3. Allows provisioning with force: true
    const forceRes = await createAdmin({
      tenantId,
      email: "secondary.admin@mill.local",
      password: "StrongPassword123!",
      force: true,
    });

    expect(forceRes.userId).toBeDefined();
    const adminCount = await UserModel.countDocuments({ tenantId, role: "admin", status: "active" });
    expect(adminCount).toBe(2);
  });
});

