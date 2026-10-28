import mongoose, { Schema, Document } from "mongoose";

export interface IAuditLog extends Document {
  tenantId: string;
  userId: string;
  userRole: string;
  action: string;
  entity: string;
  entityId?: string;
  changes?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  statusCode: number;
  durationMs: number;
  requestId: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    tenantId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    userRole: { type: String, required: true },
    action: { type: String, required: true },
    entity: { type: String, required: true, index: true },
    entityId: { type: String },
    changes: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
    userAgent: { type: String },
    statusCode: { type: Number, required: true },
    durationMs: { type: Number, required: true },
    requestId: { type: String, required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AuditLogSchema.index({ tenantId: 1, createdAt: -1 });

export const AuditLogModel = mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
