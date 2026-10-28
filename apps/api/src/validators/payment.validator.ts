import { z } from "zod";
import { NotificationChannel } from "@loompilot/shared";

export const CreatePaymentFollowupSchema = z.object({
  deliveryId: z.string().min(1, "deliveryId is required"),
  orderId: z.string().min(1, "orderId is required"),
  customerId: z.string().min(1, "customerId is required"),
  invoiceNumber: z.string().min(1, "invoiceNumber is required"),
  totalInvoicePaise: z.number().int().nonnegative(),
  amountReceivedPaise: z.number().int().nonnegative().optional().default(0),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dueDate must be YYYY-MM-DD"),
  paymentTerms: z.string().optional().default("Net 30"),
});

export const AddReminderDraftSchema = z.object({
  reminderNumber: z.number().int().positive(),
  channel: z.nativeEnum(NotificationChannel),
  recipient: z.string().min(1),
  subject: z.string().optional(),
  messageBody: z.string().min(1),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "scheduledDate must be YYYY-MM-DD"),
});

export const ApproveReminderSchema = z.object({
  action: z.enum(["approve", "reject"]),
  rejectionReason: z.string().optional(),
});

export const RecordReceiptSchema = z.object({
  amountPaise: z.number().int().positive("amountPaise must be positive"),
});

export type CreatePaymentFollowupInput = z.infer<typeof CreatePaymentFollowupSchema>;
export type AddReminderDraftInput = z.infer<typeof AddReminderDraftSchema>;
export type ApproveReminderInput = z.infer<typeof ApproveReminderSchema>;
export type RecordReceiptInput = z.infer<typeof RecordReceiptSchema>;
