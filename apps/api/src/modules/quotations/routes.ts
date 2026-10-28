import { Router } from "express";
import { QuotationController } from "./controller.js";
import { authMiddleware } from "../../middleware/auth.js";
import { requireRole, maskFinancialDataMiddleware } from "../../middleware/rbac.js";
import { UserRole } from "@loompilot/shared";

export const quotationsRouter = Router();

quotationsRouter.use(authMiddleware);
quotationsRouter.use(maskFinancialDataMiddleware);

quotationsRouter.get("/", QuotationController.list);
quotationsRouter.get("/:id", QuotationController.getById);
quotationsRouter.get("/:id/pdf", QuotationController.downloadPdf);

quotationsRouter.post(
  "/:id/approve",
  requireRole(UserRole.OWNER, UserRole.MANAGER),
  QuotationController.approve
);

quotationsRouter.post(
  "/:id/send",
  requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.SALES),
  QuotationController.send
);

quotationsRouter.post(
  "/:id/confirm",
  requireRole(UserRole.OWNER, UserRole.MANAGER),
  QuotationController.confirm
);

