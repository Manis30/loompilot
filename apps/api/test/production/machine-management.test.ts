import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { Types } from "mongoose";
import { createApp } from "../../src/app.js";
import {
  MachineModel,
  UserModel,
  ClientModel,
  SettingsModel,
  AuditLogModel,
  MaintenanceTicketModel,
} from "../../src/models/index.js";
import {
  createTestUser,
  createTestClientAccount,
  generateTestAuthHeader,
  ensureDefaultSettings,
} from "../helpers/auth-helper.js";

describe("Persistent Machine Management Test Suite (Registration & Status Updates)", () => {
  let app: any;
  const tenantId = `tenant_mch_${Date.now()}`;
  let adminToken: string;
  let adminUserId: string;

  let supervisorToken: string;
  let supervisorUserId: string;

  let restrictedSupervisorToken: string;
  let restrictedSupervisorUserId: string;

  let clientToken: string;
  let clientId: string;

  const otherTenantId = `tenant_mch_other_${Date.now()}`;
  let otherTenantToken: string;

  beforeAll(async () => {
    app = createApp();
    await ensureDefaultSettings(tenantId);
    await ensureDefaultSettings(otherTenantId);

    // 1. Admin
    const { user: adminUser } = await createTestUser({ tenantId, role: "admin" });
    adminUserId = String(adminUser._id);
    adminToken = generateTestAuthHeader({
      subjectId: adminUserId,
      realm: "user",
      tenantId,
      role: "admin",
    });

    // 2. Supervisor with assigned areas
    const { user: supUser } = await createTestUser({
      tenantId,
      role: "supervisor",
      processAreas: ["knitting", "dyeing_processing", "cutting", "stitching"],
    });
    supervisorUserId = String(supUser._id);
    supervisorToken = generateTestAuthHeader({
      subjectId: supervisorUserId,
      realm: "user",
      tenantId,
      role: "supervisor",
      processAreas: ["knitting", "dyeing_processing", "cutting", "stitching"],
    });

    // 3. Supervisor restricted only to "knitting"
    const { user: restrictedSup } = await createTestUser({
      tenantId,
      role: "supervisor",
      processAreas: ["knitting"],
    });
    restrictedSupervisorUserId = String(restrictedSup._id);
    restrictedSupervisorToken = generateTestAuthHeader({
      subjectId: restrictedSupervisorUserId,
      realm: "user",
      tenantId,
      role: "supervisor",
      processAreas: ["knitting"],
    });

    // 4. Client user
    const { account } = await createTestClientAccount({ tenantId });
    clientId = String(account._id);
    clientToken = generateTestAuthHeader({
      subjectId: clientId,
      realm: "client",
      tenantId,
      clientId,
    });

    // 5. Other tenant supervisor
    const { user: otherSup } = await createTestUser({ tenantId: otherTenantId, role: "supervisor" });
    otherTenantToken = generateTestAuthHeader({
      subjectId: String(otherSup._id),
      realm: "user",
      tenantId: otherTenantId,
      role: "supervisor",
    });
  });

  afterAll(async () => {
    const tenants = { $in: [tenantId, otherTenantId] };
    await MachineModel.deleteMany({ tenantId: tenants });
    await MaintenanceTicketModel.deleteMany({ tenantId: tenants });
    await UserModel.deleteMany({ tenantId: tenants });
    await ClientModel.deleteMany({ tenantId: tenants });
    await SettingsModel.deleteMany({ tenantId: tenants });
    await AuditLogModel.deleteMany({ tenantId: tenants });
  });

  describe("POST /api/v1/machines (Machine Registration)", () => {
    it("admin can successfully register a new machine asset with available status", async () => {
      const machineCode = `MCH-KNIT-${Date.now().toString().slice(-4)}`;
      const res = await request(app)
        .post("/api/v1/machines")
        .set("Authorization", adminToken)
        .send({
          machineCode,
          machineName: "Mayer & Cie Circular Knitting Machine",
          processArea: "knitting",
          capacityUnitsPerDay: 950,
          machineType: "Circular Knitter",
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.machineCode).toBe(machineCode.toUpperCase());
      expect(res.body.data.currentStatus).toBe("available");

      const persisted = await MachineModel.findOne({ tenantId, machineCode: machineCode.toUpperCase() });
      expect(persisted).toBeTruthy();
      expect(persisted?.machineName).toBe("Mayer & Cie Circular Knitting Machine");

      // Verify audit log
      const audit = await AuditLogModel.findOne({
        tenantId,
        action: "MACHINE_CREATED",
        "entity.id": String(persisted?._id),
      });
      expect(audit).toBeTruthy();
    });

    it("supervisor can register a machine in their assigned process area", async () => {
      const machineCode = `MCH-SUP-${Date.now().toString().slice(-4)}`;
      const res = await request(app)
        .post("/api/v1/machines")
        .set("Authorization", restrictedSupervisorToken)
        .send({
          machineCode,
          machineName: "Terrot Single Jersey Circular Loom",
          processArea: "knitting",
          capacityUnitsPerDay: 1100,
          machineType: "Circular Loom",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.machineCode).toBe(machineCode.toUpperCase());
    });

    it("supervisor is blocked with 403 when registering outside their assigned process area", async () => {
      const machineCode = `MCH-CUT-${Date.now().toString().slice(-4)}`;
      const res = await request(app)
        .post("/api/v1/machines")
        .set("Authorization", restrictedSupervisorToken)
        .send({
          machineCode,
          machineName: "Gerber Automatic Fabric Cutter",
          processArea: "cutting",
          capacityUnitsPerDay: 500,
          machineType: "Fabric Cutter",
        });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain("Access denied");
    });

    it("rejects duplicate machineCode with 409 DUPLICATE", async () => {
      const machineCode = `MCH-DUP-${Date.now().toString().slice(-4)}`;
      await request(app)
        .post("/api/v1/machines")
        .set("Authorization", adminToken)
        .send({
          machineCode,
          machineName: "Original Machine",
          processArea: "knitting",
          capacityUnitsPerDay: 800,
        });

      const dupRes = await request(app)
        .post("/api/v1/machines")
        .set("Authorization", adminToken)
        .send({
          machineCode,
          machineName: "Duplicate Machine",
          processArea: "knitting",
          capacityUnitsPerDay: 800,
        });

      expect(dupRes.status).toBe(409);
      expect(dupRes.body.error.code).toBe("DUPLICATE");
    });

    it("rejects invalid input schema (missing machineName, negative capacity) with 400", async () => {
      const res = await request(app)
        .post("/api/v1/machines")
        .set("Authorization", adminToken)
        .send({
          machineCode: "MCH-BAD",
          processArea: "knitting",
          capacityUnitsPerDay: -50,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_FAILED");
    });

    it("blocks client user with 403 FORBIDDEN", async () => {
      const res = await request(app)
        .post("/api/v1/machines")
        .set("Authorization", clientToken)
        .send({
          machineCode: "MCH-CLI",
          machineName: "Client Machine",
          processArea: "knitting",
          capacityUnitsPerDay: 800,
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });
  });

  describe("PATCH /api/v1/machines/:id/status (Machine Status Updates)", () => {
    it("updates machine status to 'maint' and logs audit entry", async () => {
      const machine = await MachineModel.create({
        tenantId,
        machineCode: `MCH-MNT-${Date.now().toString().slice(-4)}`,
        machineName: "Rieter Ring Frame G38",
        processArea: "knitting",
        capacityUnitsPerDay: 750,
        currentStatus: "available",
      });

      const res = await request(app)
        .patch(`/api/v1/machines/${machine._id}/status`)
        .set("Authorization", supervisorToken)
        .send({
          status: "maint",
          notes: "Scheduled monthly spindle bearing greasing",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.currentStatus).toBe("maint");

      const refreshed = await MachineModel.findById(machine._id);
      expect(refreshed?.currentStatus).toBe("maint");

      const audit = await AuditLogModel.findOne({
        tenantId,
        action: "MACHINE_STATUS_UPDATED",
        "entity.id": String(machine._id),
      });
      expect(audit).toBeTruthy();
      expect(audit?.before.currentStatus).toBe("available");
      expect(audit?.after.currentStatus).toBe("maint");
    });

    it("can update status by machineCode identifier", async () => {
      const machineCode = `MCH-BYCODE-${Date.now().toString().slice(-4)}`;
      await MachineModel.create({
        tenantId,
        machineCode,
        machineName: "Saurer Schlafhorst BD 480",
        processArea: "knitting",
        capacityUnitsPerDay: 600,
        currentStatus: "maint",
      });

      const res = await request(app)
        .patch(`/api/v1/machines/${machineCode}/status`)
        .set("Authorization", adminToken)
        .send({
          currentStatus: "available",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.currentStatus).toBe("available");

      const refreshed = await MachineModel.findOne({ tenantId, machineCode });
      expect(refreshed?.currentStatus).toBe("available");
    });

    it("blocks transition to 'available' with 400 when an unresolved breakdown ticket exists", async () => {
      const machine = await MachineModel.create({
        tenantId,
        machineCode: `MCH-BLOCKED-${Date.now().toString().slice(-4)}`,
        machineName: "Murata Vortex Spinner 870",
        processArea: "knitting",
        capacityUnitsPerDay: 900,
        currentStatus: "breakdown",
      });

      // Create an open breakdown ticket for this machine
      const ticket = await MaintenanceTicketModel.create({
        tenantId,
        machineId: machine._id,
        issue: "Main drive belt snapped during high speed winding",
        technicianName: "S. Murugan",
        status: "open",
      });

      // Attempt to mark available while ticket is still "open"
      const res = await request(app)
        .patch(`/api/v1/machines/${machine._id}/status`)
        .set("Authorization", supervisorToken)
        .send({
          status: "available",
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain("unresolved");

      // Verify machine status did NOT change
      const unChanged = await MachineModel.findById(machine._id);
      expect(unChanged?.currentStatus).toBe("breakdown");

      // Now resolve the ticket
      ticket.status = "resolved";
      await ticket.save();

      // Attempt to mark available again -> should succeed now
      const successRes = await request(app)
        .patch(`/api/v1/machines/${machine._id}/status`)
        .set("Authorization", supervisorToken)
        .send({
          status: "available",
        });

      expect(successRes.status).toBe(200);
      expect(successRes.body.data.currentStatus).toBe("available");
    });

    it("supervisor is blocked with 403 when updating machine in non-assigned process area", async () => {
      const machine = await MachineModel.create({
        tenantId,
        machineCode: `MCH-STITCH-${Date.now().toString().slice(-4)}`,
        machineName: "Juki Industrial Overlock MO-6800",
        processArea: "stitching",
        capacityUnitsPerDay: 400,
        currentStatus: "available",
      });

      // restrictedSupervisorToken has only ["knitting"]
      const res = await request(app)
        .patch(`/api/v1/machines/${machine._id}/status`)
        .set("Authorization", restrictedSupervisorToken)
        .send({
          status: "maint",
        });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain("Access denied");
    });

    it("returns 404 NOT_FOUND for non-existent machine ID", async () => {
      const fakeId = new Types.ObjectId();
      const res = await request(app)
        .patch(`/api/v1/machines/${fakeId}/status`)
        .set("Authorization", adminToken)
        .send({
          status: "maint",
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("cross-tenant isolation: cannot update machine belonging to another tenant", async () => {
      const foreignMachine = await MachineModel.create({
        tenantId: otherTenantId,
        machineCode: `MCH-FOREIGN-${Date.now().toString().slice(-4)}`,
        machineName: "Foreign Mill Loom",
        processArea: "knitting",
        capacityUnitsPerDay: 500,
        currentStatus: "available",
      });

      // Attempt to access other tenant's machine using our tenant's token
      const res = await request(app)
        .patch(`/api/v1/machines/${foreignMachine._id}/status`)
        .set("Authorization", adminToken)
        .send({
          status: "maint",
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");

      // Verify other tenant's machine remained available
      const unChanged = await MachineModel.findById(foreignMachine._id);
      expect(unChanged?.currentStatus).toBe("available");
    });

    it("blocks client user with 403 FORBIDDEN", async () => {
      const machine = await MachineModel.create({
        tenantId,
        machineCode: `MCH-CLI2-${Date.now().toString().slice(-4)}`,
        machineName: "Dornier Rapier Loom",
        processArea: "knitting",
        capacityUnitsPerDay: 700,
        currentStatus: "available",
      });

      const res = await request(app)
        .patch(`/api/v1/machines/${machine._id}/status`)
        .set("Authorization", clientToken)
        .send({
          status: "maint",
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });
  });
});
