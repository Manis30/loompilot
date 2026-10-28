import { describe, it, expect, beforeEach } from "vitest";
import { PaymentService } from "../../src/services/payment.service.js";
import {
  IPaymentRepository,
  Payment,
  NewPayment,
  PaymentReminder,
} from "../../src/interfaces/payment.repository.js";
import { FakeUnitOfWork } from "../../src/repositories/unit-of-work.js";
import { ListQuery, Page, toPage } from "../../src/utils/pagination.js";
import { Actor } from "../../src/utils/actor.js";
import { PaymentStatus, ReminderStatus, UserRole } from "@loompilot/shared";
import { NotFoundError } from "../../src/errors/index.js";

class FakePaymentRepository implements IPaymentRepository {
  private payments: Payment[] = [];

  async create(data: NewPayment): Promise<Payment> {
    const payment: Payment = {
      id: `pay_${Date.now()}_${Math.random()}`,
      tenantId: data.tenantId,
      deliveryId: data.deliveryId,
      orderId: data.orderId,
      customerId: data.customerId,
      invoiceNumber: data.invoiceNumber,
      totalInvoicePaise: data.totalInvoicePaise,
      amountReceivedPaise: data.amountReceivedPaise ?? 0,
      balancePaise: data.balancePaise,
      dueDate: data.dueDate,
      paymentTerms: data.paymentTerms ?? "Net 30",
      status: data.status ?? PaymentStatus.PENDING,
      reminders: (data.reminders || []).map((r, idx) => ({
        ...r,
        id: (r as any).id || `rem_${Date.now()}_${idx}`,
      })),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.payments.push(payment);
    return payment;
  }

  async findById(tenantId: string, id: string): Promise<Payment | null> {
    return this.payments.find((p) => p.tenantId === tenantId && p.id === id) || null;
  }

  async findByInvoiceNumber(tenantId: string, invoiceNumber: string): Promise<Payment | null> {
    return this.payments.find((p) => p.tenantId === tenantId && p.invoiceNumber === invoiceNumber) || null;
  }

  async list(tenantId: string, query?: ListQuery): Promise<Page<Payment>> {
    const filtered = this.payments.filter((p) => p.tenantId === tenantId);
    return toPage(filtered, filtered.length, query?.page || 1, query?.limit || 50);
  }

  async update(tenantId: string, id: string, update: Partial<Payment>): Promise<Payment | null> {
    const payment = await this.findById(tenantId, id);
    if (!payment) return null;
    Object.assign(payment, update, { updatedAt: new Date() });
    return payment;
  }

  async addReminderDraft(
    tenantId: string,
    paymentId: string,
    reminder: Omit<PaymentReminder, "id">
  ): Promise<Payment | null> {
    const payment = await this.findById(tenantId, paymentId);
    if (!payment) return null;
    const newRem: PaymentReminder = {
      ...reminder,
      id: `rem_${Date.now()}`,
    };
    payment.reminders.push(newRem);
    payment.updatedAt = new Date();
    return payment;
  }

  async updateReminder(
    tenantId: string,
    paymentId: string,
    reminderId: string,
    update: Partial<PaymentReminder>
  ): Promise<Payment | null> {
    const payment = await this.findById(tenantId, paymentId);
    if (!payment) return null;
    const rem = payment.reminders.find((r) => r.id === reminderId);
    if (!rem) return null;
    Object.assign(rem, update);
    payment.updatedAt = new Date();
    return payment;
  }
}

describe("Unit: PaymentService", () => {
  let fakeRepo: FakePaymentRepository;
  let fakeUow: FakeUnitOfWork;
  let service: PaymentService;

  const accountsActor: Actor = {
    userId: "usr_accounts",
    email: "accounts@loompilot.test",
    role: UserRole.ACCOUNTS,
    tenantId: "tenant_pay_unit",
  };

  beforeEach(() => {
    fakeRepo = new FakePaymentRepository();
    fakeUow = new FakeUnitOfWork();
    service = new PaymentService(fakeRepo, fakeUow);
  });

  it("creates a payment follow-up with correct initial balance and status", async () => {
    const payment = await service.createFollowup(accountsActor, {
      deliveryId: "del_100",
      orderId: "ord_100",
      customerId: "cust_100",
      invoiceNumber: "INV-2026-001",
      totalInvoicePaise: 5000000,
      dueDate: "2026-12-15",
      paymentTerms: "Net 30",
    });

    expect(payment.id).toBeDefined();
    expect(payment.totalInvoicePaise).toBe(5000000);
    expect(payment.amountReceivedPaise).toBe(0);
    expect(payment.balancePaise).toBe(5000000);
    expect(payment.status).toBe(PaymentStatus.PENDING);
    expect(payment.reminders).toHaveLength(0);
  });

  it("adds a reminder draft to an existing payment follow-up", async () => {
    const payment = await service.createFollowup(accountsActor, {
      deliveryId: "del_100",
      orderId: "ord_100",
      customerId: "cust_100",
      invoiceNumber: "INV-2026-001",
      totalInvoicePaise: 5000000,
      dueDate: "2026-12-15",
    });

    const updated = await service.addReminderDraft(accountsActor, payment.id, {
      reminderNumber: 1,
      channel: "email",
      recipient: "accounts@customer.com",
      subject: "Payment Reminder: Invoice INV-2026-001",
      messageBody: "Dear Customer, invoice is due soon.",
      scheduledDate: "2026-12-10",
    });

    expect(updated.reminders).toHaveLength(1);
    expect(updated.reminders[0].status).toBe(ReminderStatus.DRAFT);
    expect(updated.reminders[0].reminderNumber).toBe(1);
    expect(updated.reminders[0].recipient).toBe("accounts@customer.com");
  });

  it("approves a reminder draft (exclusive accounts role action)", async () => {
    const payment = await service.createFollowup(accountsActor, {
      deliveryId: "del_100",
      orderId: "ord_100",
      customerId: "cust_100",
      invoiceNumber: "INV-2026-001",
      totalInvoicePaise: 5000000,
      dueDate: "2026-12-15",
    });

    const withDraft = await service.addReminderDraft(accountsActor, payment.id, {
      reminderNumber: 1,
      channel: "email",
      recipient: "accounts@customer.com",
      subject: "Payment Reminder",
      messageBody: "Please pay.",
    });

    const reminderId = withDraft.reminders[0].id;
    const approved = await service.approveReminder(accountsActor, payment.id, reminderId, {
      action: "approve",
    });

    const reminder = approved.reminders.find((r) => r.id === reminderId);
    expect(reminder!.status).toBe(ReminderStatus.APPROVED);
    expect(reminder!.approvedBy).toBe(accountsActor.userId);
    expect(reminder!.approvedAt).toBeDefined();
  });

  it("rejects a reminder draft with cancellation reason", async () => {
    const payment = await service.createFollowup(accountsActor, {
      deliveryId: "del_100",
      orderId: "ord_100",
      customerId: "cust_100",
      invoiceNumber: "INV-2026-001",
      totalInvoicePaise: 5000000,
      dueDate: "2026-12-15",
    });

    const withDraft = await service.addReminderDraft(accountsActor, payment.id, {
      reminderNumber: 1,
      channel: "email",
      recipient: "accounts@customer.com",
      subject: "Payment Reminder",
      messageBody: "Please pay.",
    });

    const reminderId = withDraft.reminders[0].id;
    const rejected = await service.approveReminder(accountsActor, payment.id, reminderId, {
      action: "reject",
      rejectionReason: "Tone too aggressive",
    });

    const reminder = rejected.reminders.find((r) => r.id === reminderId);
    expect(reminder!.status).toBe(ReminderStatus.CANCELLED);
    expect(reminder!.failureReason).toBe("Tone too aggressive");
  });

  it("records partial and full receipts, updating balance and status", async () => {
    const payment = await service.createFollowup(accountsActor, {
      deliveryId: "del_100",
      orderId: "ord_100",
      customerId: "cust_100",
      invoiceNumber: "INV-2026-001",
      totalInvoicePaise: 5000000,
      dueDate: "2026-12-15",
    });

    // Partial payment
    const partial = await service.recordReceipt(accountsActor, payment.id, 2000000);
    expect(partial.amountReceivedPaise).toBe(2000000);
    expect(partial.balancePaise).toBe(3000000);
    expect(partial.status).toBe(PaymentStatus.PARTIAL);

    // Remaining payment
    const full = await service.recordReceipt(accountsActor, payment.id, 3000000);
    expect(full.amountReceivedPaise).toBe(5000000);
    expect(full.balancePaise).toBe(0);
    expect(full.status).toBe(PaymentStatus.RECEIVED);
  });

  it("throws NotFoundError when payment record is missing", async () => {
    await expect(
      service.getById(accountsActor, "nonexistent")
    ).rejects.toThrow(NotFoundError);
  });
});
