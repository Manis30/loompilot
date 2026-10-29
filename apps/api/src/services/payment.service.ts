import {
  IPaymentRepository,
  Payment,
} from "../interfaces/payment.repository.js";
import { IUnitOfWork } from "../interfaces/unit-of-work.js";
import { IAuditLogRepository } from "../interfaces/audit-log.js";
import { Actor } from "../utils/actor.js";
import { ListQuery, Page } from "../utils/pagination.js";
import {
  CreatePaymentFollowupInput,
  AddReminderDraftInput,
  ApproveReminderInput,
} from "../validators/payment.validator.js";
import { NotFoundError } from "../errors/index.js";
import { PaymentStatus, ReminderStatus } from "@loompilot/shared";

export class PaymentService {
  constructor(
    private readonly repo: IPaymentRepository,
    _uow?: IUnitOfWork,
    private readonly audit?: IAuditLogRepository
  ) {}

  async list(actor: Actor, query?: ListQuery): Promise<Page<Payment>> {
    return this.repo.list(actor.tenantId, query);
  }

  async getById(actor: Actor, id: string): Promise<Payment> {
    const payment = await this.repo.findById(actor.tenantId, id);
    if (!payment) {
      throw new NotFoundError(`Payment record with ID ${id} not found`);
    }
    return payment;
  }

  async createFollowup(
    actor: Actor,
    input: CreatePaymentFollowupInput
  ): Promise<Payment> {
    const balancePaise = input.totalInvoicePaise - (input.amountReceivedPaise ?? 0);

    const payment = await this.repo.create({
      tenantId: actor.tenantId,
      deliveryId: input.deliveryId,
      orderId: input.orderId,
      customerId: input.customerId,
      invoiceNumber: input.invoiceNumber,
      totalInvoicePaise: input.totalInvoicePaise,
      amountReceivedPaise: input.amountReceivedPaise ?? 0,
      balancePaise,
      dueDate: input.dueDate,
      paymentTerms: input.paymentTerms ?? "Net 30",
      status: PaymentStatus.PENDING,
      reminders: [],
    });

    if (this.audit) {
      await this.audit.record({
        tenantId: actor.tenantId,
        userId: actor.userId,
        userRole: actor.role,
        action: "PAYMENT_FOLLOWUP_CREATED",
        entity: "payment",
        entityId: payment.id,
        changes: { invoiceNumber: payment.invoiceNumber, totalInvoicePaise: payment.totalInvoicePaise },
      });
    }

    return payment;
  }

  async addReminderDraft(
    actor: Actor,
    paymentId: string,
    input: AddReminderDraftInput
  ): Promise<Payment> {
    const payment = await this.repo.addReminderDraft(actor.tenantId, paymentId, {
      reminderNumber: input.reminderNumber,
      channel: input.channel,
      recipient: input.recipient,
      subject: input.subject,
      messageBody: input.messageBody,
      scheduledDate: input.scheduledDate,
      status: ReminderStatus.DRAFT,
    });

    if (!payment) {
      throw new NotFoundError(`Payment record with ID ${paymentId} not found`);
    }

    return payment;
  }

  async approveReminder(
    actor: Actor,
    paymentId: string,
    reminderId: string,
    input: ApproveReminderInput
  ): Promise<Payment> {
    const payment = await this.repo.findById(actor.tenantId, paymentId);
    if (!payment) {
      throw new NotFoundError(`Payment record with ID ${paymentId} not found`);
    }

    const reminder = payment.reminders.find((r) => r.id === reminderId);
    if (!reminder) {
      throw new NotFoundError(`Reminder draft with ID ${reminderId} not found`);
    }

    const update: any = {};
    if (input.action === "approve") {
      update.status = ReminderStatus.APPROVED;
      update.approvedBy = actor.userId;
      update.approvedAt = new Date();
    } else {
      update.status = ReminderStatus.CANCELLED;
      update.failureReason = input.rejectionReason || "Rejected by accounts";
    }

    const updatedPayment = await this.repo.updateReminder(
      actor.tenantId,
      paymentId,
      reminderId,
      update
    );

    if (this.audit) {
      await this.audit.record({
        tenantId: actor.tenantId,
        actorId: actor.userId,
        actorRole: actor.role,
        action: `REMINDER_${input.action.toUpperCase()}`,
        entityType: "payment_reminder",
        entityId: reminderId,
        before: { status: reminder.status },
        after: { paymentId, ...update },
      });
    }

    return updatedPayment!;
  }

  async recordReceipt(
    actor: Actor,
    paymentId: string,
    amountPaise: number
  ): Promise<Payment> {
    const payment = await this.repo.findById(actor.tenantId, paymentId);
    if (!payment) {
      throw new NotFoundError(`Payment record with ID ${paymentId} not found`);
    }

    const newAmountReceived = payment.amountReceivedPaise + amountPaise;
    const newBalance = Math.max(0, payment.totalInvoicePaise - newAmountReceived);
    const newStatus = newBalance === 0 ? PaymentStatus.RECEIVED : PaymentStatus.PARTIAL;

    const updatedPayment = await this.repo.update(actor.tenantId, paymentId, {
      amountReceivedPaise: newAmountReceived,
      balancePaise: newBalance,
      status: newStatus,
    });

    if (this.audit) {
      await this.audit.record({
        tenantId: actor.tenantId,
        userId: actor.userId,
        userRole: actor.role,
        action: "PAYMENT_RECEIPT_RECORDED",
        entity: "payment",
        entityId: paymentId,
        changes: { amountPaise, newBalance, status: newStatus },
      });
    }

    return updatedPayment!;
  }
}
