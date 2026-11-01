import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { Types } from "mongoose";
import { createApp } from "../../src/app.js";
import {
  OrderModel,
  MachineModel,
  UserModel,
  NotificationModel,
  SupervisorDailyReportModel,
  MaintenanceTicketModel,
} from "../../src/models/index.js";
import {
  createTestUser,
  generateTestAuthHeader,
  ensureDefaultSettings,
} from "../helpers/auth-helper.js";
import { getEnv } from "../../src/config/env.js";

describe("Phase 6 — Production & Supervisor Operations Test Suite", () => {
  let app: any;
  const tenantId = `tenant_prod_${Date.now()}`;
  let adminToken: string;
  let supervisorToken: string;
  let supervisor2Token: string;
  let supervisorId: string;
  let supervisor2Id: string;
  let adminId: string;
  let testMachineId: string;
  let testOrderId: string;
  let testReportId: string;
  let testTicketId: string;

  beforeAll(async () => {
    app = createApp();
    await ensureDefaultSettings(tenantId);

    // 1. Admin User
    const { user: adminUser } = await createTestUser({ tenantId, role: "admin" });
    adminId = String(adminUser._id);
    adminToken = generateTestAuthHeader({
      subjectId: adminId,
      realm: "user",
      tenantId,
      role: "admin",
    });

    // 2. Supervisor 1 (knitting, cutting)
    const { user: s1User } = await createTestUser({
      tenantId,
      role: "supervisor",
      processAreas: ["knitting", "cutting"],
    });
    supervisorId = String(s1User._id);
    supervisorToken = generateTestAuthHeader({
      subjectId: supervisorId,
      realm: "user",
      tenantId,
      role: "supervisor",
    });

    // 3. Supervisor 2 (stitching)
    const { user: s2User } = await createTestUser({
      tenantId,
      role: "supervisor",
      processAreas: ["stitching"],
    });
    supervisor2Id = String(s2User._id);
    supervisor2Token = generateTestAuthHeader({
      subjectId: supervisor2Id,
      realm: "user",
      tenantId,
      role: "supervisor",
    });

    // 4. Test Machine
    const machine = await MachineModel.create({
      tenantId,
      machineCode: `KNIT-${Date.now().toString().slice(-4)}`,
      machineName: "Circular Knitter #1",
      processArea: "knitting",
      capacityUnitsPerDay: 500,
      currentStatus: "available",
      version: 1,
    });
    testMachineId = String(machine._id);

    // 5. Test Order in 'assigned' status assigned to supervisor 1
    const order = await OrderModel.create({
      tenantId,
      orderNumber: `ORD-PROD-${Date.now().toString().slice(-4)}`,
      clientId: new Types.ObjectId(),
      quantity: 1000,
      deliveryDeadline: "2026-12-15",
      productDescription: "100% Cotton Rib Knit T-Shirts",
      status: "assigned",
      spec: { sizes: ["M", "L"], fabric: "Single Jersey 180 GSM" },
      production: {
        phase: "knitting",
        percentComplete: 0,
        producedQty: 0,
        assignedSupervisors: [
          {
            supervisorId: new Types.ObjectId(supervisorId),
            processes: ["knitting"],
          },
        ],
        processPlan: [
          { stage: "knitting", start: "2026-11-01", end: "2026-11-10", dailyTarget: 100 },
          { stage: "stitching", start: "2026-11-11", end: "2026-11-20", dailyTarget: 100 },
        ],
        stageTotals: [],
      },
      source: "admin_manual",
      requestVersion: 1,
      version: 1,
    });
    testOrderId = String(order._id);
  });

  afterAll(async () => {
    await SupervisorDailyReportModel.deleteMany({ tenantId });
    await MaintenanceTicketModel.deleteMany({ tenantId });
    await OrderModel.deleteMany({ tenantId });
    await MachineModel.deleteMany({ tenantId });
    await NotificationModel.deleteMany({ tenantId });
  });

  describe("1. Supervisor Orders API (Rate-free projection)", () => {
    it("GET /api/v1/supervisor/orders returns only orders assigned to authenticated supervisor", async () => {
      const res = await request(app)
        .get("/api/v1/supervisor/orders")
        .set("Authorization", supervisorToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      const assignedOrder = res.body.data.find((o: any) => o.id === testOrderId);
      expect(assignedOrder).toBeDefined();
      expect(assignedOrder.orderNumber).toBeDefined();
      expect(assignedOrder.spec).toBeDefined();

      // Rate-free invariant: no costing, prices, or margins in response
      expect(assignedOrder.costing).toBeUndefined();
      expect(assignedOrder.totalPaise).toBeUndefined();
      expect(assignedOrder.financials).toBeUndefined();
      expect(assignedOrder.quotation).toBeUndefined();
    });

    it("GET /api/v1/supervisor/orders returns empty list for unassigned supervisor", async () => {
      const res = await request(app)
        .get("/api/v1/supervisor/orders")
        .set("Authorization", supervisor2Token);

      expect(res.status).toBe(200);
      const assignedOrder = res.body.data.find((o: any) => o.id === testOrderId);
      expect(assignedOrder).toBeUndefined();
    });
  });

  describe("2. Supervisor Daily Report Operations", () => {
    const reportDate = "2026-11-02";

    it("rejects report submission when workforce sum does not equal employeesPresentTotal", async () => {
      const res = await request(app)
        .post("/api/v1/supervisor/reports")
        .set("Authorization", supervisorToken)
        .send({
          reportDate,
          processAreas: ["knitting"],
          employeesPresentTotal: 10,
          workforce: [
            { area: "knitting", count: 6 },
            { area: "cutting", count: 2 }, // 6 + 2 = 8 != 10
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it("successfully submits daily report, updates order stageTotals and transitions order to in_production", async () => {
      const res = await request(app)
        .post("/api/v1/supervisor/reports")
        .set("Authorization", supervisorToken)
        .send({
          reportDate,
          processAreas: ["knitting"],
          employeesPresentTotal: 8,
          workforce: [
            { area: "knitting", count: 6 },
            { area: "cutting", count: 2 },
          ],
          resources: { machinesAvail: 4, machinesDown: 1 },
          outputs: [
            {
              orderId: testOrderId,
              stage: "knitting",
              produced: 250,
              defective: 5,
            },
          ],
          machines: [
            {
              machineId: testMachineId,
              status: "breakdown",
              hours: 4,
              remarks: "Broken needle drive belt",
            },
          ],
          clientGeneratedId: `client_gen_${Date.now()}`,
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.status).toBe("submitted");
      expect(res.body.data.reportDate).toBe(reportDate);
      testReportId = String(res.body.data._id);

      // Verify Order stageTotals, producedQty, percentComplete and status transition
      const order = await OrderModel.findById(testOrderId).lean();
      expect(order).toBeDefined();
      expect(order!.status).toBe("in_production");
      expect(order!.production?.producedQty).toBe(250);
      expect(order!.production?.percentComplete).toBe(25); // 250 / 1000 = 25%
      expect(order!.production?.stageTotals).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ stage: "knitting", produced: 250, defective: 5 }),
        ])
      );

      // Verify machine status changed to breakdown
      const machine = await MachineModel.findById(testMachineId).lean();
      expect(machine!.currentStatus).toBe("breakdown");

      // Verify maintenance ticket auto-created for breakdown machine
      const ticket = await MaintenanceTicketModel.findOne({
        tenantId,
        machineId: new Types.ObjectId(testMachineId),
      }).lean();
      expect(ticket).toBeDefined();
      expect(ticket!.status).toBe("open");
      expect(ticket!.issue).toContain("Broken needle drive belt");
      testTicketId = String(ticket!._id);
    });

    it("rejects duplicate report submission for same supervisor and same date", async () => {
      const res = await request(app)
        .post("/api/v1/supervisor/reports")
        .set("Authorization", supervisorToken)
        .send({
          reportDate,
          processAreas: ["knitting"],
          employeesPresentTotal: 8,
          workforce: [{ area: "knitting", count: 8 }],
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBeDefined();
    });

    it("GET /api/v1/supervisor/reports lists supervisor's historical reports", async () => {
      const res = await request(app)
        .get("/api/v1/supervisor/reports")
        .set("Authorization", supervisorToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      const found = res.body.data.find((r: any) => String(r._id) === testReportId);
      expect(found).toBeDefined();
      expect(found.reportDate).toBe(reportDate);
    });

    it("GET /api/v1/supervisor/reports/:id retrieves report detail and blocks other supervisors", async () => {
      // Supervisor 1 access -> OK
      const res1 = await request(app)
        .get(`/api/v1/supervisor/reports/${testReportId}`)
        .set("Authorization", supervisorToken);
      expect(res1.status).toBe(200);
      expect(res1.body.data.reportDate).toBe(reportDate);

      // Supervisor 2 access -> 403 Forbidden
      const res2 = await request(app)
        .get(`/api/v1/supervisor/reports/${testReportId}`)
        .set("Authorization", supervisor2Token);
      expect(res2.status).toBe(403);
    });

    it("PATCH /api/v1/supervisor/reports/:id records correction and marks report corrected", async () => {
      const res = await request(app)
        .patch(`/api/v1/supervisor/reports/${testReportId}`)
        .set("Authorization", supervisorToken)
        .send({
          reason: "Corrected employee present total from 8 to 9 following afternoon shift adjustment",
          employeesPresentTotal: 9,
          workforce: [
            { area: "knitting", count: 7 },
            { area: "cutting", count: 2 },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("corrected");
      expect(res.body.data.employeesPresentTotal).toBe(9);
      expect(res.body.data.corrections).toHaveLength(1);
      expect(res.body.data.corrections[0].reason).toContain("afternoon shift");
    });

    it("GET /api/v1/supervisor-reports allows Admin cross-supervisor review", async () => {
      const res = await request(app)
        .get("/api/v1/supervisor-reports")
        .set("Authorization", adminToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      const found = res.body.data.find((r: any) => String(r._id) === testReportId);
      expect(found).toBeDefined();
    });
  });

  describe("3. Maintenance Tickets Management", () => {
    it("POST /api/v1/maintenance-tickets creates a new ticket and updates machine status", async () => {
      const res = await request(app)
        .post("/api/v1/maintenance-tickets")
        .set("Authorization", supervisorToken)
        .send({
          machineId: testMachineId,
          issue: "Motor overheating under continuous load",
          notes: "Need electrical inspection",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe("open");
      expect(res.body.data.issue).toContain("overheating");
    });

    it("GET /api/v1/maintenance-tickets lists tickets with populated machine data", async () => {
      const res = await request(app)
        .get("/api/v1/maintenance-tickets")
        .set("Authorization", supervisorToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      const ticket = res.body.data.find((t: any) => String(t._id) === testTicketId);
      expect(ticket).toBeDefined();
      expect(ticket.machineId).toBeDefined();
      expect(ticket.machineId.machineCode).toBeDefined();
    });

    it("PATCH /api/v1/maintenance-tickets/:id rejects assignment without technicianName and technicianContact", async () => {
      const res = await request(app)
        .patch(`/api/v1/maintenance-tickets/${testTicketId}`)
        .set("Authorization", adminToken)
        .send({
          status: "assigned",
          // Missing technicianName and technicianContact
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain("technicianName is required");
    });

    it("PATCH /api/v1/maintenance-tickets/:id assigns ticket, updates machine to maint", async () => {
      const res = await request(app)
        .patch(`/api/v1/maintenance-tickets/${testTicketId}`)
        .set("Authorization", adminToken)
        .send({
          status: "assigned",
          technicianName: "Ramesh Sharma",
          technicianContact: "+91 9876543210",
          notes: "Technician dispatched to knitting floor",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("assigned");
      expect(res.body.data.technicianName).toBe("Ramesh Sharma");

      // Verify machine status updated to maint
      const machine = await MachineModel.findById(testMachineId).lean();
      expect(machine!.currentStatus).toBe("maint");
    });

    it("PATCH /api/v1/maintenance-tickets/:id resolves ticket, restores machine to available", async () => {
      const res = await request(app)
        .patch(`/api/v1/maintenance-tickets/${testTicketId}`)
        .set("Authorization", adminToken)
        .send({
          status: "resolved",
          notes: "Drive belt replaced and calibrated. Running operational test.",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("resolved");
      expect(res.body.data.resolvedAt).toBeDefined();

      // Verify machine status restored to available
      const machine = await MachineModel.findById(testMachineId).lean();
      expect(machine!.currentStatus).toBe("available");
    });
  });

  describe("4. Production Tracking Board & Monitoring Operations", () => {
    it("GET /api/v1/production/board returns board grouped by phase and summary metrics", async () => {
      const res = await request(app)
        .get("/api/v1/production/board")
        .set("Authorization", supervisorToken);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.summary).toBeDefined();
      expect(res.body.data.summary.totalActiveOrders).toBeGreaterThanOrEqual(1);
      expect(res.body.data.byPhase).toBeDefined();
      expect(res.body.data.byPhase.knitting).toBeDefined();

      const orderInPhase = res.body.data.byPhase.knitting.find((o: any) => o.id === testOrderId);
      expect(orderInPhase).toBeDefined();
      // Supervisor view is rate-free
      expect(orderInPhase.costing).toBeUndefined();
      expect(orderInPhase.totalPaise).toBeUndefined();
    });

    it("POST /api/v1/orders/:id/monitoring/run triggers live monitoring analysis and updates order", async () => {
      const res = await request(app)
        .post(`/api/v1/orders/${testOrderId}/monitoring/run`)
        .set("Authorization", supervisorToken)
        .set("Idempotency-Key", `idemp_mon_${Date.now()}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.production.monitoring).toBeDefined();
      expect(res.body.data.production.monitoring.status).toBe("on_track");
    });

    it("POST /internal/v1/monitoring-snapshots ingests snapshot from AI agents gateway and notifies on delay", async () => {
      const env = getEnv();
      const internalSecret = env.AGENT_SERVICE_TOKEN;

      const res = await request(app)
        .post("/internal/v1/monitoring-snapshots")
        .set("x-internal-secret", internalSecret)
        .send({
          schemaVersion: "1.0",
          orderId: testOrderId,
          tenantId,
          phase: "stitching",
          percentComplete: 40,
          onTrack: false,
          predictedDelayDays: 3,
          recommendations: ["Allocate additional stitching line to clear bottleneck"],
          bottleneckStage: "stitching",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify order monitoring updated to behind/at_risk
      const order = await OrderModel.findById(testOrderId).lean();
      expect(order!.production?.monitoring?.status).toBe("behind");
      expect(order!.production?.phase).toBe("stitching");
      expect(order!.production?.percentComplete).toBe(40);

      // Verify alert notification dispatched to supervisor
      const notif = await NotificationModel.findOne({
        tenantId,
        "recipient.userId": new Types.ObjectId(supervisorId),
        type: "production_delay",
      }).lean();
      expect(notif).toBeDefined();
      expect(notif!.kind).toBe("alert");
      expect(notif!.body).toContain("stitching");
    });

    it("GET /api/v1/supervisor/notifications returns alerts for authenticated supervisor", async () => {
      const res = await request(app)
        .get("/api/v1/supervisor/notifications")
        .set("Authorization", supervisorToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      const delayAlert = res.body.data.find((n: any) => n.type === "production_delay");
      expect(delayAlert).toBeDefined();
      expect(delayAlert.kind).toBe("alert");
    });
  });
});
