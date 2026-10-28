import { IAuditLogRepository, AuditLogEntry } from "../interfaces/audit-log.js";
import { TxContext } from "../interfaces/unit-of-work.js";
import { AuditLogModel } from "../models/audit.model.js";

export class MongoAuditLogRepository implements IAuditLogRepository {
  async record(entry: AuditLogEntry, tx?: TxContext): Promise<void> {
    await AuditLogModel.create([entry], { session: tx?.session || null });
  }

  async list(tenantId: string, limit = 100): Promise<AuditLogEntry[]> {
    const docs = await AuditLogModel.find({ tenantId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return docs.map((doc: any) => ({
      id: doc._id.toString(),
      tenantId: doc.tenantId,
      userId: doc.userId,
      userRole: doc.userRole,
      action: doc.action,
      entity: doc.entity,
      entityId: doc.entityId,
      changes: doc.changes,
      ipAddress: doc.ipAddress,
      userAgent: doc.userAgent,
      statusCode: doc.statusCode,
      durationMs: doc.durationMs,
      requestId: doc.requestId,
      createdAt: doc.createdAt,
    }));
  }
}
