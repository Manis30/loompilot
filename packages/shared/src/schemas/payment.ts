import { z } from "zod";
import { NotificationChannel, PaymentStatus, ReminderStatus } from "../enums.js";

export const PaymentReminderDraftSchema = z.object({
  id: z.string(),
  reminderNumber: z.number().int().positive(),
  channel: z.nativeEnum(NotificationChannel),
  recipient: z.string().min(1),
  subject: z.string().optional(),
  messageBody: z.string().min(1),
  scheduledDate: z.string(),
  status: z.nativeEnum(ReminderStatus).default(ReminderStatus.DRAFT),
  approvedBy: z.string().optional(),
  approvedAt: z.date().optional(),
  sentAt: z.date().optional(),
  failureReason: z.string().optional(),
});

export const PaymentFollowupSchema = z.object({
  id: z.string().optional(),
  tenantId: z.string().min(1),
  deliveryId: z.string().min(1),
  orderId: z.string().min(1),
  customerId: z.string().min(1),
  invoiceNumber: z.string().min(1),
  totalInvoicePaise: z.number().int().positive(),
  amountReceivedPaise: z.number().int().nonnegative().default(0),
  balancePaise: z.number().int().nonnegative(),
  dueDate: z.string(),
  status: z.nativeEnum(PaymentStatus).default(PaymentStatus.PENDING),
  paymentTerms: z.string().default("Net 30"),
  reminders: z.array(PaymentReminderDraftSchema).default([]),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export const ApproveReminderRequestSchema = z.object({
  action: z.enum(["approve", "reject"]),
  rejectionReason: z.string().optional(),
});

export type PaymentReminderDraft = z.infer<typeof PaymentReminderDraftSchema>;
export type PaymentFollowupDto = z.infer<typeof PaymentFollowupSchema>;
export type ApproveReminderRequest = z.infer<typeof ApproveReminderRequestSchema>;

