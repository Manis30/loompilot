import { FilterQuery, Types } from "mongoose";
import { IAuditLog, AuditLogModel } from "../models/platform/audit-log.model.js";

export interface AuditQueryFilters {
  entity?: string;
  actorId?: string;
  actorType?: string;
  action?: string;
  dateFrom?: string | Date;
  dateTo?: string | Date;
}

export class AuditLogRepository {
  private readonly model = AuditLogModel;

  /**
   * Immutable insert: Audit logs can only ever be appended.
   */
  async create(data: {
    tenantId: string;
    actor: {
      id: Types.ObjectId | string | null;
      type: "user" | "client" | "agent" | "system";
      email?: string;
    };
    action: string;
    entity: {
      collection: string;
      id: string;
    };
    before?: Record<string, any>;
    after?: Record<string, any>;
    ip?: string;
    requestId?: string;
  }): Promise<IAuditLog> {
    let actorId: Types.ObjectId | null = null;
    if (data.actor.id) {
      if (typeof data.actor.id === "string") {
        actorId = Types.ObjectId.isValid(data.actor.id) ? new Types.ObjectId(data.actor.id) : null;
      } else {
        actorId = data.actor.id;
      }
    }

    return this.model.create({
      ...data,
      actor: {
        ...data.actor,
        id: actorId,
      },
    });
  }

  /**
   * Paginated read-only queries with strict tenant isolation.
   */
  async findPaginated(
    tenantId: string,
    filters: AuditQueryFilters,
    page = 1,
    limit = 50
  ): Promise<{ items: IAuditLog[]; total: number; page: number; limit: number }> {
    const query: FilterQuery<IAuditLog> = { tenantId };

    if (filters.entity) {
      query["entity.collection"] = filters.entity;
    }
    if (filters.actorId) {
      query["actor.id"] = new Types.ObjectId(filters.actorId);
    }
    if (filters.actorType) {
      query["actor.type"] = filters.actorType;
    }
    if (filters.action) {
      query.action = filters.action;
    }
    if (filters.dateFrom || filters.dateTo) {
      query.createdAt = {};
      if (filters.dateFrom) query.createdAt.$gte = new Date(filters.dateFrom);
      if (filters.dateTo) query.createdAt.$lte = new Date(filters.dateTo);
    }

    const skip = (Math.max(1, page) - 1) * Math.max(1, limit);
    const [items, total] = await Promise.all([
      this.model.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.model.countDocuments(query),
    ]);

    return {
      items: items as unknown as IAuditLog[],
      total,
      page,
      limit,
    };
  }

  // NOTE: Strictly NO update, delete, or drop methods are exposed on this repository!
}
