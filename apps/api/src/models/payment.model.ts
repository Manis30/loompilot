import mongoose, { Schema, Document } from "mongoose";
import { NotificationChannel, PaymentStatus, ReminderStatus } from "@loompilot/shared";

export interface IPaymentReminderDraftDocument {
  _id?: mongoose.Types.ObjectId;
  reminderNumber: number;
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  messageBody: string;
  scheduledDate: string; // YYYY-MM-DD
  status: ReminderStatus;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  sentAt?: Date;
  failureReason?: string;
}

export interface IPaymentDocument extends Document {
  tenantId: string;
  deliveryId: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  invoiceNumber: string;
  totalInvoicePaise: number;
  amountReceivedPaise: number;
  balancePaise: number;
  dueDate: string;
  status: PaymentStatus;
  paymentTerms: string;
  reminders: IPaymentReminderDraftDocument[];
  createdAt: Date;
  updatedAt: Date;
}

const PaymentReminderDraftSchema = new Schema<IPaymentReminderDraftDocument>(
  {
    reminderNumber: { type: Number, required: true },
    channel: { type: String, enum: Object.values(NotificationChannel), required: true },
    recipient: { type: String, required: true },
    subject: { type: String },
    messageBody: { type: String, required: true },
    scheduledDate: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(ReminderStatus),
      default: ReminderStatus.DRAFT,
      required: true,
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    sentAt: { type: Date },
    failureReason: { type: String },
  },
  { timestamps: true }
);

const PaymentSchema = new Schema<IPaymentDocument>(
  {
    tenantId: { type: String, required: true, index: true },
    deliveryId: { type: Schema.Types.ObjectId, ref: "Delivery", required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: "ProductionOrder", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    invoiceNumber: { type: String, required: true },
    totalInvoicePaise: { type: Number, required: true, min: 0 },
    amountReceivedPaise: { type: Number, default: 0, min: 0 },
    balancePaise: { type: Number, required: true, min: 0 },
    dueDate: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.PENDING,
      required: true,
      index: true,
    },
    paymentTerms: { type: String, default: "Net 30" },
    reminders: [PaymentReminderDraftSchema],
  },
  { timestamps: true }
);

PaymentSchema.index({ tenantId: 1, invoiceNumber: 1 }, { unique: true });

export const PaymentModel = mongoose.model<IPaymentDocument>("Payment", PaymentSchema);

