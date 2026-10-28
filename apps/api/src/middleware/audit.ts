import { Request, Response, NextFunction } from "express";
import { IAuditLogRepository } from "../interfaces/audit-log.js";
import { logger } from "../config/logger.js";

let auditRepository: IAuditLogRepository | null = null;

export function registerAuditRepository(repo: IAuditLogRepository): void {
  auditRepository = repo;
}

export function auditMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    const start = Date.now();

    res.on("finish", async () => {
      if (req.path === "/health" || res.statusCode >= 500) return;

      try {
        const tenantId = req.user?.tenantId || (req.headers["x-tenant-id"] as string) || "system";
        const userId = req.user?.userId || "anonymous";
        const userRole = req.user?.role || "service";

        if (auditRepository) {
          await auditRepository.record({
            tenantId,
            userId,
            userRole,
            action: `${req.method} ${req.baseUrl}${req.path}`,
            entity: req.baseUrl.replace(/^\/api\//, "").replace(/^\/internal\//, "") || "unknown",
            entityId: req.params.id || req.body?.id || undefined,
            changes: req.method !== "GET" ? req.body : undefined,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
            statusCode: res.statusCode,
            durationMs: Date.now() - start,
            requestId: req.requestId,
          });
        }
      } catch (err) {
        logger.error({ err, requestId: req.requestId }, "Failed to write audit log entry");
      }
    });
  }

  next();
}
