import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";

export interface IOutboxRecipient {
  userId?: Types.ObjectId;
  clientId?: Types.ObjectId;
}

export interface IOutboxMessage extends BaseEntity {
  recipient: IOutboxRecipient;
  channel: "email" | "whatsapp" | "sms";
  status: "pending" | "processing" | "sent" | "failed";
  attempts: number;
  payload: Record<string, any>;
  error?: string;
  nextAttemptAt?: Date;
}

const OutboxRecipientSchema = new Schema<IOutboxRecipient>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    clientId: { type: Schema.Types.ObjectId, ref: "Client" },
  },
  { _id: false, strict: true }
);

const OutboxMessageSchema = new Schema<IOutboxMessage>(
  {
    tenantId: { type: String, required: true, index: true },
    recipient: { type: OutboxRecipientSchema, required: true },
    channel: {
      type: String,
      enum: ["email", "whatsapp", "sms"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "sent", "failed"],
      default: "pending",
      required: true,
    },
    attempts: { type: Number, default: 0 },
    payload: { type: Schema.Types.Mixed, required: true },
    error: { type: String },
    nextAttemptAt: { type: Date, default: Date.now },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

// Rule 10: OutboxMessage recipient XOR check
OutboxMessageSchema.path("recipient").validate(function (recipient: any) {
  const hasUser = Boolean(recipient?.userId);
  const hasClient = Boolean(recipient?.clientId);
  return (hasUser && !hasClient) || (!hasUser && hasClient);
}, "OutboxMessage must specify exactly one recipient: userId OR clientId (XOR)");

OutboxMessageSchema.index({ tenantId: 1, status: 1, nextAttemptAt: 1 });

export const OutboxMessageModel: mongoose.Model<IOutboxMessage> =
  (mongoose.models.OutboxMessage as mongoose.Model<IOutboxMessage>) ||
  mongoose.model<IOutboxMessage>("OutboxMessage", OutboxMessageSchema, "outboxMessages");
