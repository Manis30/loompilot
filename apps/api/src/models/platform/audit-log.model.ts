import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";

export interface IAuditActor {
  id: Types.ObjectId | null;
  type: "user" | "client" | "agent" | "system";
  email?: string;
}

export interface IAuditEntity {
  collection: string;
  id: string;
}

export interface IAuditLog extends BaseEntity {
  actor: IAuditActor;
  action: string;
  entity: IAuditEntity;
  before?: Record<string, any>;
  after?: Record<string, any>;
  ip?: string;
  requestId?: string;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    tenantId: { type: String, required: true, index: true },
    actor: {
      id: { type: Schema.Types.ObjectId, default: null },
      type: {
        type: String,
        enum: ["user", "client", "agent", "system"],
        required: true,
      },
      email: { type: String },
    },
    action: { type: String, required: true },
    entity: {
      collection: { type: String, required: true },
      id: { type: String, required: true },
    },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    ip: { type: String },
    requestId: { type: String },
    version: { type: Number, default: 1 },
  },
  { timestamps: true, suppressReservedKeysWarning: true }
);

AuditLogSchema.index({ tenantId: 1, "entity.collection": 1, "entity.id": 1 });
AuditLogSchema.index({ tenantId: 1, createdAt: -1 });

export const AuditLogModel: mongoose.Model<IAuditLog> =
  (mongoose.models.AuditLog as mongoose.Model<IAuditLog>) ||
  mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
