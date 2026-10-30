import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";

export interface IOutboxMessage extends BaseEntity {
  userId?: Types.ObjectId;
  clientAccountId?: Types.ObjectId;
  channel: string;
  status: "pending" | "processing" | "sent" | "failed";
  attempts: number;
  payload: Record<string, any>;
  error?: string;
  nextAttemptAt?: Date;
}

const OutboxMessageSchema = new Schema<IOutboxMessage>(
  {
    tenantId: { type: String, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    clientAccountId: { type: Schema.Types.ObjectId, ref: "ClientAccount" },
    channel: { type: String, required: true },
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

// Exactly one recipient (userId OR clientAccountId) required
OutboxMessageSchema.pre("validate", function (next) {
  const hasUser = Boolean(this.userId);
  const hasClient = Boolean(this.clientAccountId);
  if ((hasUser && hasClient) || (!hasUser && !hasClient)) {
    next(new Error("OutboxMessage must specify exactly one recipient: userId OR clientAccountId"));
  } else {
    next();
  }
});

OutboxMessageSchema.index({ tenantId: 1, status: 1, nextAttemptAt: 1 });

export const OutboxMessageModel =
  mongoose.models.OutboxMessage ||
  mongoose.model<IOutboxMessage>("OutboxMessage", OutboxMessageSchema);
