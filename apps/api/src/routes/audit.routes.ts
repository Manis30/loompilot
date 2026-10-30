import { Router } from "express";
import { AuditController } from "../controllers/audit.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";

export const auditRouter: Router = Router();

auditRouter.use(authenticate);

auditRouter.get(
  "/",
  authorize("GET /api/v1/audit"),
  AuditController.list
);
