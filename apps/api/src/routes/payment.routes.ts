import { Router } from "express";
import { PaymentController } from "../controllers/payment.controller.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { ApproveReminderSchema, RecordReceiptSchema } from "../validators/payment.validator.js";
import { UserRole } from "@loompilot/shared";

export function createPaymentRoutes(controller: PaymentController): Router {
  const router = Router();

  router.use(authMiddleware);

  // Only Owner, Manager, Accounts can view payments. Store and Sales cannot.
  router.get(
    "/",
    requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTS),
    controller.list
  );

  router.get(
    "/:id",
    requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTS),
    controller.getById
  );

  // Strictly exclusive to Accounts role!
  router.post(
    "/:id/reminders/:reminderId/approve",
    requireRole(UserRole.ACCOUNTS),
    validate(ApproveReminderSchema),
    controller.approveReminder
  );

  router.post(
    "/:id/receipts",
    requireRole(UserRole.OWNER, UserRole.ACCOUNTS),
    validate(RecordReceiptSchema),
    controller.recordReceipt
  );

  return router;
}
