import { Router } from "express";
import { ReportController } from "../controllers/report.controller.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { UserRole } from "@loompilot/shared";

export function createReportRoutes(controller: ReportController): Router {
  const router = Router();

  router.use(authMiddleware);

  // Sensitive financial margin report: Owner and Accounts only
  router.get(
    "/margin",
    requireRole(UserRole.OWNER, UserRole.ACCOUNTS),
    controller.getMarginReport
  );

  // Operational on-time performance report: Owner, Manager, Sales
  router.get(
    "/on-time",
    requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.SALES),
    controller.getOnTimeReport
  );

  // Financial collections report: Owner and Accounts only
  router.get(
    "/collections",
    requireRole(UserRole.OWNER, UserRole.ACCOUNTS),
    controller.getCollectionsReport
  );

  return router;
}

