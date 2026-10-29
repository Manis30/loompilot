import {
  IAuditLogRepository,
  AuditLogEntry,
  AuditQueryFilters,
} from "../interfaces/audit-log.js";
import { TxContext } from "../interfaces/unit-of-work.js";
import { AuditLogModel } from "../models/audit.model.js";

export class MongoAuditLogRepository implements IAuditLogRepository {
  private toEntity(doc: any): AuditLogEntry {
    return {
      id: doc._id.toString(),
      tenantId: doc.tenantId,
      actorId: doc.actorId || doc.userId || "system",
      actorRole: doc.actorRole || doc.userRole || "unknown",
      action: doc.action,
      entityType: doc.entityType || doc.entity || "unknown",
      entityId: doc.entityId,
      before: doc.before,
      after: doc.after,
      ip: doc.ip || doc.ipAddress,
      userAgent: doc.userAgent,
      timestamp: doc.timestamp || doc.createdAt || new Date(),

      userId: doc.userId || doc.actorId,
      userRole: doc.userRole || doc.actorRole,
      entity: doc.entity || doc.entityType,
      changes: doc.changes,
      ipAddress: doc.ipAddress || doc.ip,
      statusCode: doc.statusCode,
      durationMs: doc.durationMs,
      requestId: doc.requestId,
      createdAt: doc.createdAt,
    };
  }

  async record(
    entry: Partial<AuditLogEntry> & { tenantId: string; action: string },
    tx?: TxContext
  ): Promise<void> {
    const actorId = entry.actorId || entry.userId || "system";
    const actorRole = entry.actorRole || entry.userRole || "unknown";
    const entityType = entry.entityType || entry.entity || "unknown";
    const ip = entry.ip || entry.ipAddress;
    const timestamp = entry.timestamp || new Date();

    const normalized = {
      tenantId: entry.tenantId,
      actorId,
      actorRole,
      action: entry.action,
      entityType,
      entityId: entry.entityId,
      before: entry.before,
      after: entry.after,
      ip,
      userAgent: entry.userAgent,
      timestamp,

      userId: actorId,
      userRole: actorRole,
      entity: entityType,
      changes: entry.changes || entry.after,
      ipAddress: ip,
      statusCode: entry.statusCode || 200,
      durationMs: entry.durationMs || 0,
      requestId: entry.requestId || "unknown",
    };

    await AuditLogModel.create([normalized], { session: tx?.session || null });
  }

  async list(tenantId: string, limit = 100): Promise<AuditLogEntry[]> {
    const docs = await AuditLogModel.find({ tenantId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return docs.map((doc: any) => this.toEntity(doc));
  }

  async query(
    tenantId: string,
    filters: AuditQueryFilters
  ): Promise<{ data: AuditLogEntry[]; total: number }> {
    const filter: any = { tenantId };

    if (filters.entityType) {
      filter.$or = [
        { entityType: filters.entityType },
        { entity: filters.entityType },
      ];
    }
    if (filters.entityId) {
      filter.entityId = filters.entityId;
    }
    if (filters.actorId) {
      filter.$or = [
        { actorId: filters.actorId },
        { userId: filters.actorId },
      ];
    }
    if (filters.startDate || filters.endDate) {
      filter.timestamp = {};
      if (filters.startDate) {
        filter.timestamp.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        filter.timestamp.$lte = new Date(filters.endDate);
      }
    }

    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 50));
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      AuditLogModel.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLogModel.countDocuments(filter),
    ]);

    return {
      data: docs.map((doc: any) => this.toEntity(doc)),
      total,
    };
  }
}
