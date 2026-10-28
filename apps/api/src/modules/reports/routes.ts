import { Router } from "express";
import { ReportsController } from "./controller.js";
import { authMiddleware } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { UserRole } from "@loompilot/shared";

export const reportsRouter = Router();

reportsRouter.use(authMiddleware);

// Sensitive financial margin report: Owner and Accounts only
reportsRouter.get(
  "/margin",
  requireRole(UserRole.OWNER, UserRole.ACCOUNTS),
  ReportsController.getMarginReport
);

// Operational on-time performance report: Owner, Manager, Sales
reportsRouter.get(
  "/on-time",
  requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.SALES),
  ReportsController.getOnTimeReport
);

// Financial collections report: Owner and Accounts only
reportsRouter.get(
  "/collections",
  requireRole(UserRole.OWNER, UserRole.ACCOUNTS),
  ReportsController.getCollectionsReport
);

