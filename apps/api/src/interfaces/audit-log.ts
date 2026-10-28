import { TxContext } from "./unit-of-work.js";

export interface AuditLogEntry {
  id?: string;
  tenantId: string;
  userId: string;
  userRole: string;
  action: string;
  entity: string;
  entityId?: string;
  changes?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  statusCode?: number;
  durationMs?: number;
  requestId?: string;
  createdAt?: Date;
}

export interface IAuditLogRepository {
  record(entry: AuditLogEntry, tx?: TxContext): Promise<void>;
  list(tenantId: string, limit?: number): Promise<AuditLogEntry[]>;
}
