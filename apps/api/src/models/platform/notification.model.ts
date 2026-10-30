import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";

export interface INotificationRecipient {
  userId?: Types.ObjectId;
  clientId?: Types.ObjectId;
}

export interface INotificationEntity {
  collection: string;
  id: string;
}

export interface INotification extends BaseEntity {
  recipient: INotificationRecipient;
  kind: "notification" | "alert";
  type: string;
  channel: "in_app" | "email" | "whatsapp" | "sms";
  status: "pending" | "sent" | "failed" | "delivered";
  attempts: number;
  title: string;
  body: string;
  entity?: INotificationEntity;
  dedupeKey?: string;
  readAt?: Date | null;
  resolvedAt?: Date | null;
}

const RecipientSchema = new Schema<INotificationRecipient>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    clientId: { type: Schema.Types.ObjectId, ref: "Client" },
  },
  { _id: false, strict: true }
);

const EntitySchema = new Schema<INotificationEntity>(
  {
    collection: { type: String, required: true },
    id: { type: String, required: true },
  },
  { _id: false, strict: true }
);

const NotificationSchema = new Schema<INotification>(
  {
    tenantId: { type: String, required: true, index: true },
    recipient: { type: RecipientSchema, required: true },
    kind: {
      type: String,
      enum: ["notification", "alert"],
      default: "notification",
      required: true,
    },
    type: { type: String, required: true },
    channel: {
      type: String,
      enum: ["in_app", "email", "whatsapp", "sms"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "sent", "failed", "delivered"],
      default: "pending",
      required: true,
    },
    attempts: { type: Number, default: 0 },
    title: { type: String, required: true },
    body: { type: String, required: true },
    entity: { type: EntitySchema },
    dedupeKey: { type: String },
    readAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

// Rule 10: Notification recipient XOR check
NotificationSchema.path("recipient").validate(function (recipient: any) {
  const hasUser = Boolean(recipient?.userId);
  const hasClient = Boolean(recipient?.clientId);
  return (hasUser && !hasClient) || (!hasUser && hasClient);
}, "Notification must specify exactly one recipient: userId OR clientId (XOR)");

NotificationSchema.index({ tenantId: 1, "recipient.userId": 1, createdAt: -1 });
NotificationSchema.index({ tenantId: 1, "recipient.clientId": 1, createdAt: -1 });
NotificationSchema.index({ tenantId: 1, status: 1 });
NotificationSchema.index(
  { tenantId: 1, dedupeKey: 1 },
  {
    unique: true,
    partialFilterExpression: { dedupeKey: { $type: "string" } },
  }
);

export const NotificationModel: mongoose.Model<INotification> =
  (mongoose.models.Notification as mongoose.Model<INotification>) ||
  mongoose.model<INotification>("Notification", NotificationSchema);
