import { describe, it, beforeAll, afterAll, beforeEach, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { setupTestDB, teardownTestDB, clearTestDB } from "./setup.js";
import { authService, quotationRepository, paymentRepository } from "../src/container.js";
import { UserRole, QuotationStatus, PaymentStatus, ReminderStatus } from "@loompilot/shared";
import mongoose from "mongoose";

interface RouteTestCase {
  method: "get" | "post";
  pathBuilder: (ctx: { quoteId: string; paymentId: string; reminderId: string }) => string;
  allowedRoles: UserRole[];
  payload?: any;
}

const RBAC_MATRIX: RouteTestCase[] = [
  {
    method: "post",
    pathBuilder: () => "/api/workforce/workers",
    allowedRoles: [UserRole.OWNER, UserRole.MANAGER],
    payload: {
      workerCode: "WRK-RBAC-01",
      name: "Rbac Worker",
      skillLevel: "mid",
    },
  },
  {
    method: "post",
    pathBuilder: ({ quoteId }) => `/api/quotations/${quoteId}/approve`,
    allowedRoles: [UserRole.OWNER, UserRole.MANAGER],
  },
  {
    method: "post",
    pathBuilder: ({ quoteId }) => `/api/quotations/${quoteId}/send`,
    allowedRoles: [UserRole.OWNER, UserRole.MANAGER, UserRole.SALES],
  },
  {
    method: "post",
    pathBuilder: ({ quoteId }) => `/api/quotations/${quoteId}/confirm`,
    allowedRoles: [UserRole.OWNER, UserRole.MANAGER],
  },
  {
    method: "get",
    pathBuilder: () => "/api/reports/margin",
    allowedRoles: [UserRole.OWNER, UserRole.ACCOUNTS],
  },
  {
    method: "get",
    pathBuilder: () => "/api/reports/on-time",
    allowedRoles: [UserRole.OWNER, UserRole.MANAGER, UserRole.SALES],
  },
  {
    method: "get",
    pathBuilder: () => "/api/reports/collections",
    allowedRoles: [UserRole.OWNER, UserRole.ACCOUNTS],
  },
  {
    method: "post",
    pathBuilder: ({ paymentId, reminderId }) => `/api/payments/${paymentId}/reminders/${reminderId}/approve`,
    allowedRoles: [UserRole.ACCOUNTS],
    payload: { action: "approve" },
  },
  {
    method: "post",
    pathBuilder: () => "/api/workforce/daily-outputs",
    allowedRoles: [UserRole.OWNER, UserRole.MANAGER],
    payload: {
      orderId: new mongoose.Types.ObjectId().toString(),
      processId: new mongoose.Types.ObjectId().toString(),
      date: "2026-10-28",
      quantityProduced: 100,
      idempotencyKey: "idem_rbac",
    },
  },
];

const ALL_ROLES: UserRole[] = [
  UserRole.OWNER,
  UserRole.MANAGER,
  UserRole.SALES,
  UserRole.STORE,
  UserRole.ACCOUNTS,
];

describe("Table-Driven: Complete RBAC Route Matrix (docs/roles-matrix.md)", () => {
  const tenantId = "tenant_rbac_matrix_test";
  const tokens: Record<UserRole, string> = {} as any;
  let quoteId: string;
  let paymentId: string;
  let reminderId: string;

  beforeAll(async () => {
    await setupTestDB();
  }, 60000);

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    // 1. Create first user (Owner)
    const owner = await authService.register({
      tenantId,
      email: "owner@matrix.test",
      password: "password123",
      name: "Owner",
      role: UserRole.OWNER,
    });
    const ownerActor = { tenantId, userId: owner.id, role: UserRole.OWNER, email: owner.email };
    const ownerLogin = await authService.login({ tenantId, email: "owner@matrix.test", password: "password123" });
    tokens[UserRole.OWNER] = ownerLogin.accessToken;

    // 2. Register other 4 roles using owner actor
    for (const role of ALL_ROLES.filter((r) => r !== UserRole.OWNER)) {
      const email = `${role}@matrix.test`;
      await authService.register(
        { tenantId, email, password: "password123", name: role, role },
        ownerActor
      );
      const login = await authService.login({ tenantId, email, password: "password123" });
      tokens[role] = login.accessToken;
    }

    // 3. Setup test quotation
    const quote = await quotationRepository.create({
      tenantId,
      enquiryId: new mongoose.Types.ObjectId().toString(),
      customerId: new mongoose.Types.ObjectId().toString(),
      quotationNumber: "QT-RBAC-001",
      lineItems: [],
      materialCostPaise: 50000,
      subtotalCostPaise: 50000,
      marginPct: 10,
      finalPricePaise: 55000,
      etaDate: "2026-11-20",
      validUntil: "2026-11-10",
      status: QuotationStatus.DRAFT,
      explanation: "RBAC quote",
    });
    quoteId = quote.id;

    // 4. Setup test payment with reminder
    const payment = await paymentRepository.create({
      tenantId,
      deliveryId: new mongoose.Types.ObjectId().toString(),
      orderId: new mongoose.Types.ObjectId().toString(),
      customerId: new mongoose.Types.ObjectId().toString(),
      invoiceNumber: "INV-RBAC-001",
      totalInvoicePaise: 1000000,
      amountReceivedPaise: 0,
      balancePaise: 1000000,
      dueDate: "2026-12-15",
      paymentTerms: "Net 30",
      status: PaymentStatus.PENDING,
    });
    paymentId = payment.id;

    const withReminder = await paymentRepository.addReminderDraft(tenantId, paymentId, {
      reminderNumber: 1,
      channel: "email",
      recipient: "cust@matrix.test",
      subject: "Due Soon",
      messageBody: "Please pay",
      status: ReminderStatus.DRAFT,
    });
    reminderId = withReminder!.reminders[0].id;
  });

  // Table-driven generation: Route x Role
  describe.each(RBAC_MATRIX)(
    "$method.toUpperCase() route matrix enforcement",
    ({ method, pathBuilder, allowedRoles, payload }) => {
      it.each(ALL_ROLES)("evaluates permission for role: %s", async (role) => {
        const path = pathBuilder({ quoteId, paymentId, reminderId });
        const token = tokens[role];
        const isAllowed = allowedRoles.includes(role);

        let req = method === "get" ? request(app).get(path) : request(app).post(path);
        req = req.set("Authorization", `Bearer ${token}`);
        if (payload) req = req.send(payload);

        const res = await req;

        if (isAllowed) {
          // Permitted roles must NOT receive 403 Forbidden
          expect(res.status).not.toBe(403);
          expect(res.status).not.toBe(401);
        } else {
          // Forbidden roles MUST receive 403 Forbidden
          expect(res.status).toBe(403);
          expect(res.body.error).toBe("Forbidden");
        }
      });
    }
  );
});
