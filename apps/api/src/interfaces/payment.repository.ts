import { NotificationChannel, PaymentStatus, ReminderStatus } from "@loompilot/shared";
import { TxContext } from "./unit-of-work.js";
import { ListQuery, Page } from "../utils/pagination.js";

export interface PaymentReminderDraft {
  id: string;
  reminderNumber: number;
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  messageBody: string;
  scheduledDate: string;
  status: ReminderStatus;
  approvedBy?: string;
  approvedAt?: Date;
  sentAt?: Date;
  failureReason?: string;
}

export interface Payment {
  id: string;
  tenantId: string;
  deliveryId: string;
  orderId: string;
  customerId: string;
  invoiceNumber: string;
  totalInvoicePaise: number;
  amountReceivedPaise: number;
  balancePaise: number;
  dueDate: string;
  status: PaymentStatus;
  paymentTerms: string;
  reminders: PaymentReminderDraft[];
  createdAt: Date;
  updatedAt: Date;
}

export interface NewPayment {
  tenantId: string;
  deliveryId: string;
  orderId: string;
  customerId: string;
  invoiceNumber: string;
  totalInvoicePaise: number;
  amountReceivedPaise?: number;
  balancePaise: number;
  dueDate: string;
  status?: PaymentStatus;
  paymentTerms?: string;
  reminders?: PaymentReminderDraft[];
}

export interface NewReminderDraft {
  reminderNumber: number;
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  messageBody: string;
  scheduledDate: string;
  status?: ReminderStatus;
}

export interface IPaymentRepository {
  create(data: NewPayment, tx?: TxContext): Promise<Payment>;
  findById(tenantId: string, id: string, tx?: TxContext): Promise<Payment | null>;
  findByInvoiceNumber(tenantId: string, invoiceNumber: string, tx?: TxContext): Promise<Payment | null>;
  addReminderDraft(
    tenantId: string,
    paymentId: string,
    draft: NewReminderDraft,
    tx?: TxContext
  ): Promise<Payment | null>;
  updateReminder(
    tenantId: string,
    paymentId: string,
    reminderId: string,
    update: Partial<PaymentReminderDraft>,
    tx?: TxContext
  ): Promise<Payment | null>;
  update(tenantId: string, id: string, data: Partial<Payment>, tx?: TxContext): Promise<Payment | null>;
  list(tenantId: string, query?: ListQuery): Promise<Page<Payment>>;
  count(tenantId: string, tx?: TxContext): Promise<number>;
}

