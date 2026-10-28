import { Router } from "express";
import { PaymentController } from "./controller.js";
import { authMiddleware } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { UserRole } from "@loompilot/shared";

export const paymentsRouter = Router();

paymentsRouter.use(authMiddleware);

// Only Owner, Manager, Accounts can view payments. Store and Sales cannot.
paymentsRouter.get(
  "/",
  requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTS),
  PaymentController.list
);

paymentsRouter.get(
  "/:id",
  requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTS),
  PaymentController.getById
);

// Strictly exclusive to Accounts role!
paymentsRouter.post(
  "/:id/reminders/:reminderId/approve",
  requireRole(UserRole.ACCOUNTS),
  PaymentController.approveReminder
);

paymentsRouter.post(
  "/:id/receipts",
  requireRole(UserRole.OWNER, UserRole.ACCOUNTS),
  PaymentController.recordReceipt
);
