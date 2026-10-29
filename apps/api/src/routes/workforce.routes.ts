import { Router } from "express";
import { WorkforceController } from "../controllers/workforce.controller.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { idempotencyMiddleware } from "../middleware/idempotency.js";
import {
  CreateWorkerSchema,
  RecordAttendanceSchema,
  RecordDailyOutputSchema,
} from "../validators/workforce.validator.js";
import { UserRole } from "@loompilot/shared";

export function createWorkforceRoutes(controller: WorkforceController): Router {
  const router = Router();

  router.use(authMiddleware);

  router.get("/workers", controller.listWorkers);
  router.post(
    "/workers",
    requireRole(UserRole.OWNER, UserRole.MANAGER),
    validate(CreateWorkerSchema),
    controller.createWorker
  );

  router.get("/attendance", controller.getAttendance);
  router.post(
    "/attendance",
    requireRole(UserRole.OWNER, UserRole.MANAGER),
    validate(RecordAttendanceSchema),
    controller.recordAttendance
  );

  router.post(
    "/daily-outputs",
    requireRole(UserRole.OWNER, UserRole.MANAGER),
    validate(RecordDailyOutputSchema),
    idempotencyMiddleware({ allowBodyAlias: true }),
    controller.recordDailyOutput
  );

  router.get("/orders/:orderId/outputs", controller.getOutputsForOrder);

  return router;
}

