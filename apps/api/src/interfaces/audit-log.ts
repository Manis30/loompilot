import { TxContext } from "./unit-of-work.js";

export interface AuditLogEntry {
  id?: string;
  tenantId: string;
  actorId: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId?: string;
  before?: Record<string, any>;
  after?: Record<string, any>;
  ip?: string;
  userAgent?: string;
  timestamp: Date;

  // Compatibility fields
  userId?: string;
  userRole?: string;
  entity?: string;
  changes?: Record<string, any>;
  ipAddress?: string;
  statusCode?: number;
  durationMs?: number;
  requestId?: string;
  createdAt?: Date;
}

export interface AuditQueryFilters {
  entityType?: string;
  entityId?: string;
  actorId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface IAuditLogRepository {
  record(entry: Partial<AuditLogEntry> & { tenantId: string; action: string }, tx?: TxContext): Promise<void>;
  list(tenantId: string, limit?: number): Promise<AuditLogEntry[]>;
  query(tenantId: string, filters: AuditQueryFilters): Promise<{ data: AuditLogEntry[]; total: number }>;
}
