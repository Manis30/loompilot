import mongoose, { Schema, Document } from "mongoose";
import { AuditLogEntry } from "../interfaces/audit-log.js";

export interface IAuditLogDocument extends Document, Omit<AuditLogEntry, "id"> {
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLogDocument>(
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
    statusCode: { type: Number, default: 200 },
    durationMs: { type: Number, default: 0 },
    requestId: { type: String, default: "unknown" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AuditLogSchema.index({ tenantId: 1, createdAt: -1 });

export const AuditLogModel = mongoose.model<IAuditLogDocument>("AuditLog", AuditLogSchema);
