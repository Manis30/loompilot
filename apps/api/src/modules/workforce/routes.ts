import { Router } from "express";
import { WorkforceController } from "./controller.js";
import { authMiddleware } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { UserRole } from "@loompilot/shared";

export const workforceRouter = Router();

workforceRouter.use(authMiddleware);

workforceRouter.get("/workers", WorkforceController.listWorkers);
workforceRouter.post(
  "/workers",
  requireRole(UserRole.OWNER, UserRole.MANAGER),
  WorkforceController.createWorker
);

workforceRouter.get("/attendance", WorkforceController.getAttendance);
workforceRouter.post(
  "/attendance",
  requireRole(UserRole.OWNER, UserRole.MANAGER),
  WorkforceController.recordAttendance
);

workforceRouter.post(
  "/daily-outputs",
  requireRole(UserRole.OWNER, UserRole.MANAGER),
  WorkforceController.recordDailyOutput
);

workforceRouter.get("/orders/:orderId/outputs", WorkforceController.getOutputsForOrder);
