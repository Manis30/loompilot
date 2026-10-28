import { Request, Response, NextFunction } from "express";
import { AuditLogModel } from "../modules/audit/model.js";
import { logger } from "../config/logger.js";

export function auditMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Only audit state-mutating HTTP methods
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    const start = Date.now();

    res.on("finish", async () => {
      // Avoid auditing internal health checks or unsuccessful requests if not desired
      if (req.path === "/health" || res.statusCode >= 500) return;

      try {
        const tenantId = req.user?.tenantId || (req.headers["x-tenant-id"] as string) || "system";
        const userId = req.user?.userId || "anonymous";
        const userRole = req.user?.role || "service";

        await AuditLogModel.create({
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
      } catch (err) {
        logger.error({ err, requestId: req.requestId }, "Failed to write audit log entry");
      }
    });
  }

  next();
}
