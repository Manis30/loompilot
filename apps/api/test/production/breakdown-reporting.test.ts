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

describe("Persistent Machine Breakdown Reporting Test Suite", () => {
  let app: any;
  const tenantId = `tenant_maint_${Date.now()}`;
  let adminToken: string;
  let adminUserId: string;
  let supervisorToken: string;
  let supervisorUserId: string;
  let clientToken: string;
  let clientId: string;

  const otherTenantId = `tenant_maint_other_${Date.now()}`;
  let otherTenantSupervisorToken: string;

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

    // 2. Supervisor
    const { user: supUser } = await createTestUser({ tenantId, role: "supervisor" });
    supervisorUserId = String(supUser._id);
    supervisorToken = generateTestAuthHeader({
      subjectId: supervisorUserId,
      realm: "user",
      tenantId,
      role: "supervisor",
    });

    // 3. Client user
    const { account } = await createTestClientAccount({ tenantId });
    clientId = String(account._id);
    clientToken = generateTestAuthHeader({
      subjectId: clientId,
      realm: "client",
      tenantId,
      clientId,
    });

    // 4. Other tenant supervisor
    const { user: otherSup } = await createTestUser({ tenantId: otherTenantId, role: "supervisor" });
    otherTenantSupervisorToken = generateTestAuthHeader({
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

  it("supervisor reports machine breakdown by ObjectId: creates open ticket, sets machine to breakdown, and logs audit", async () => {
    const machine = await MachineModel.create({
      tenantId,
      machineCode: `LOOM-BD1-${Date.now().toString().slice(-4)}`,
      machineName: "Tsudakoma ZAX9100 Airjet Loom",
      processArea: "weaving",
      capacityUnitsPerDay: 850,
      currentStatus: "available",
      machineType: "Airjet Loom",
    });

    const res = await request(app)
      .post("/api/v1/maintenance-tickets")
      .set("Authorization", supervisorToken)
      .send({
        machineId: String(machine._id),
        issue: "Weft insertion nozzle clogging and air pressure leakage",
        notes: "Assigned Technician: K. Selvaraj (Lead Maintenance Engineer)",
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.status).toBe("open");
    expect(String(res.body.data.machineId)).toBe(String(machine._id));
    expect(res.body.data.issue).toBe("Weft insertion nozzle clogging and air pressure leakage");

    // Verify machine status in DB is updated to breakdown
    const refreshedMachine = await MachineModel.findById(machine._id);
    expect(refreshedMachine?.currentStatus).toBe("breakdown");

    // Verify ticket persistence in DB
    const ticketDoc = await MaintenanceTicketModel.findById(res.body.data._id);
    expect(ticketDoc).toBeDefined();
    expect(ticketDoc?.status).toBe("open");
    expect(String(ticketDoc?.openedBy)).toBe(supervisorUserId);

    // Verify audit log
    const audit = await AuditLogModel.findOne({
      tenantId,
      action: "MAINTENANCE_TICKET_CREATED",
      "entity.id": String(ticketDoc?._id),
    });
    expect(audit).toBeDefined();
    expect(audit?.after?.machineId).toBe(String(machine._id));
  });

  it("supervisor reports breakdown using machineCode: resolves machine correctly", async () => {
    const code = `LOOM-CODE-${Date.now().toString().slice(-4)}`;
    const machine = await MachineModel.create({
      tenantId,
      machineCode: code,
      machineName: "Picanol OmniPlus-i",
      processArea: "weaving",
      capacityUnitsPerDay: 900,
      currentStatus: "available",
    });

    const res = await request(app)
      .post("/api/v1/maintenance-tickets")
      .set("Authorization", supervisorToken)
      .send({
        machineId: code,
        issue: "Main drive motor overheating",
        notes: "High Priority floor stoppage",
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(String(res.body.data.machineId)).toBe(String(machine._id));

    const refreshed = await MachineModel.findById(machine._id);
    expect(refreshed?.currentStatus).toBe("breakdown");
  });

  it("invalid machine ID returns 404 Not Found", async () => {
    const fakeId = new Types.ObjectId();
    const res = await request(app)
      .post("/api/v1/maintenance-tickets")
      .set("Authorization", supervisorToken)
      .send({
        machineId: String(fakeId),
        issue: "Sensor failure",
      });

    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it("cross-tenant isolation: other tenant supervisor cannot report breakdown on machine from different tenant", async () => {
    const machine = await MachineModel.create({
      tenantId,
      machineCode: `ISOL-M-${Date.now().toString().slice(-4)}`,
      machineName: "Dye Vat #3",
      processArea: "dyeing_fabric_processing",
      capacityUnitsPerDay: 500,
      currentStatus: "available",
    });

    const res = await request(app)
      .post("/api/v1/maintenance-tickets")
      .set("Authorization", otherTenantSupervisorToken) // different tenant
      .send({
        machineId: String(machine._id),
        issue: "Heater element burnt",
      });

    expect(res.status).toBe(404);

    // Verify machine status in original tenant was NOT modified
    const untouched = await MachineModel.findById(machine._id);
    expect(untouched?.currentStatus).toBe("available");
  });

  it("unauthorized role: client account receives 403 Forbidden", async () => {
    const machine = await MachineModel.create({
      tenantId,
      machineCode: `CLI-RBAC-${Date.now().toString().slice(-4)}`,
      machineName: "Spinning Frame #12",
      processArea: "spinning",
      capacityUnitsPerDay: 1200,
      currentStatus: "available",
    });

    const res = await request(app)
      .post("/api/v1/maintenance-tickets")
      .set("Authorization", clientToken)
      .send({
        machineId: String(machine._id),
        issue: "Attempted client ticket",
      });

    expect(res.status).toBe(403);
  });

  it("GET /api/v1/maintenance-tickets lists created tickets for supervisor", async () => {
    const res = await request(app)
      .get("/api/v1/maintenance-tickets")
      .set("Authorization", supervisorToken);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });
});

