import mongoose, { Schema, Document } from "mongoose";
import { AuditLogEntry } from "../interfaces/audit-log.js";

export interface IAuditLogDocument extends Document, Omit<AuditLogEntry, "id"> {
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLogDocument>(
  {
    tenantId: { type: String, required: true, index: true },
    actorId: { type: String, required: true, index: true },
    actorRole: { type: String, required: true },
    action: { type: String, required: true },
    entityType: { type: String, required: true, index: true },
    entityId: { type: String, index: true },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    ip: { type: String },
    userAgent: { type: String },
    timestamp: { type: Date, default: Date.now, index: true },

    // Compatibility fields
    userId: { type: String },
    userRole: { type: String },
    entity: { type: String },
    changes: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
    statusCode: { type: Number, default: 200 },
    durationMs: { type: Number, default: 0 },
    requestId: { type: String, default: "unknown" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AuditLogSchema.index({ tenantId: 1, timestamp: -1 });
AuditLogSchema.index({ tenantId: 1, entityType: 1, entityId: 1 });
AuditLogSchema.index({ tenantId: 1, actorId: 1 });

export const AuditLogModel = mongoose.model<IAuditLogDocument>("AuditLog", AuditLogSchema);
