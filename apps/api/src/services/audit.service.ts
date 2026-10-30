import { AuditLogRepository, AuditQueryFilters } from "../repositories/audit-log.repository.js";
import { IAuditLog } from "../models/platform/audit-log.model.js";

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "currentpassword",
  "newpassword",
  "token",
  "tokenhash",
  "refreshtoken",
  "secret",
  "authorization",
  "cookie",
]);

export function sanitizeAuditData(data: any): any {
  if (!data || typeof data !== "object") return data;

  if (Array.isArray(data)) {
    return data.map(sanitizeAuditData);
  }

  const sanitized: Record<string, any> = {};
  for (const [key, val] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof val === "object" && val !== null) {
      sanitized[key] = sanitizeAuditData(val);
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
}

export class AuditService {
  constructor(private readonly auditRepo = new AuditLogRepository()) {}

  async log(params: {
    tenantId: string;
    actor: {
      id: string | null;
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
    return this.auditRepo.create({
      tenantId: params.tenantId,
      actor: params.actor,
      action: params.action,
      entity: params.entity,
      before: sanitizeAuditData(params.before),
      after: sanitizeAuditData(params.after),
      ip: params.ip,
      requestId: params.requestId,
    });
  }

  async getLogs(
    tenantId: string,
    filters: AuditQueryFilters,
    page = 1,
    limit = 50
  ) {
    return this.auditRepo.findPaginated(tenantId, filters, page, limit);
  }
}
