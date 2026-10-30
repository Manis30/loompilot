import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";

export interface INotification extends BaseEntity {
  userId?: Types.ObjectId;
  clientAccountId?: Types.ObjectId;
  channel: "inApp" | "email" | "wa" | "sms" | string;
  status: "pending" | "sent" | "failed";
  attempts: number;
  title: string;
  body: string;
  type: string;
  readAt?: Date | null;
}

const NotificationSchema = new Schema<INotification>(
  {
    tenantId: { type: String, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    clientAccountId: { type: Schema.Types.ObjectId, ref: "ClientAccount" },
    channel: {
      type: String,
      enum: ["inApp", "email", "wa", "sms"],
      default: "inApp",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "sent", "failed"],
      default: "pending",
      required: true,
    },
    attempts: { type: Number, default: 0 },
    title: { type: String, required: true },
    body: { type: String, required: true },
    type: { type: String, required: true },
    readAt: { type: Date, default: null },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

// Exactly one recipient (userId OR clientAccountId) required
NotificationSchema.pre("validate", function (next) {
  const hasUser = Boolean(this.userId);
  const hasClient = Boolean(this.clientAccountId);
  if ((hasUser && hasClient) || (!hasUser && !hasClient)) {
    next(new Error("Notification must specify exactly one recipient: userId OR clientAccountId"));
  } else {
    next();
  }
});

NotificationSchema.index({ tenantId: 1, userId: 1, readAt: 1 });

export const NotificationModel =
  mongoose.models.Notification ||
  mongoose.model<INotification>("Notification", NotificationSchema);
