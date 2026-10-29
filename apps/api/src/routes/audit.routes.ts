import { Router } from "express";
import { AuditController } from "../controllers/audit.controller.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { UserRole } from "@loompilot/shared";

export function createAuditRoutes(controller: AuditController): Router {
  const router = Router();

  router.use(authMiddleware);

  // List audit logs: OWNER only
  router.get("/", requireRole(UserRole.OWNER), controller.list);

  return router;
}

