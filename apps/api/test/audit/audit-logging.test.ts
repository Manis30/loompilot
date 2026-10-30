import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { createContainer } from "../../src/container.js";
import { AuditLogModel } from "../../src/models/platform/audit-log.model.js";
import { createTestUser, generateTestAuthHeader } from "../helpers/auth-helper.js";

describe("Stage 3: Immutable Audit Logging & Secret Redaction", () => {
  const container = createContainer();
  const app = createApp(container);
  const tenantId = "tenant_audit_test";

  it("Automatically creates audit logs with sensitive credentials redacted", async () => {
    const { user: admin } = await createTestUser({ tenantId, role: "admin", email: "audit.admin@mill.local" });
    const adminHeader = generateTestAuthHeader({
      subjectId: String(admin._id),
      realm: "user",
      role: "admin",
      tenantId,
    });

    // 1. Create a user
    const resCreate = await request(app)
      .post("/api/v1/users")
      .set("Authorization", adminHeader)
      .send({
        name: "Alice Supervisor",
        email: "alice.audit@mill.local",
        password: "SuperSecretPassword123!",
        role: "supervisor",
        processAreas: ["winding"],
      });

    expect(resCreate.status).toBe(201);
    const createdUserId = resCreate.body._id;

    // Verify audit entry for USER_CREATED
    const createAudit = await AuditLogModel.findOne({
      tenantId,
      action: "USER_CREATED",
      "entity.id": String(createdUserId),
    });

    expect(createAudit).toBeDefined();
    expect(createAudit?.actor.type).toBe("user");
    expect(String(createAudit?.actor.id)).toBe(String(admin._id));

    // CRITICAL: Ensure password or passwordHash is NEVER logged in cleartext
    const stringifiedAudit = JSON.stringify(createAudit?.toObject());
    expect(stringifiedAudit).not.toContain("SuperSecretPassword123!");

    // 2. Update user and verify audit diff
    const resUpdate = await request(app)
      .patch(`/api/v1/users/${createdUserId}`)
      .set("Authorization", adminHeader)
      .send({ name: "Alice Renamed", phone: "+919876543210" });

    expect(resUpdate.status).toBe(200);

    const updateAudit = await AuditLogModel.findOne({
      tenantId,
      action: "USER_UPDATED",
      "entity.id": String(createdUserId),
    });

    expect(updateAudit).toBeDefined();
    expect(updateAudit?.before?.name).toBe("Alice Supervisor");
    expect(updateAudit?.after?.name).toBe("Alice Renamed");
  });

  it("Supports filtered audit log querying via GET /api/v1/audit", async () => {
    const { user: admin } = await createTestUser({ tenantId, role: "admin", email: "audit.query@mill.local" });
    const adminHeader = generateTestAuthHeader({
      subjectId: String(admin._id),
      realm: "user",
      role: "admin",
      tenantId,
    });

    // Query filtered by action
    const resActionFilter = await request(app)
      .get("/api/v1/audit?action=USER_CREATED")
      .set("Authorization", adminHeader);

    expect(resActionFilter.status).toBe(200);
    expect(resActionFilter.body.items).toBeDefined();
    for (const item of resActionFilter.body.items) {
      expect(item.action).toBe("USER_CREATED");
    }

    // Query filtered by entity
    const resEntityFilter = await request(app)
      .get("/api/v1/audit?entity=users")
      .set("Authorization", adminHeader);

    expect(resEntityFilter.status).toBe(200);
    for (const item of resEntityFilter.body.items) {
      expect(item.entity.collection).toBe("users");
    }
  });
});

