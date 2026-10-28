import { Router } from "express";
import { QuotationController } from "../controllers/quotation.controller.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { UserRole } from "@loompilot/shared";

export function createQuotationRoutes(controller: QuotationController): Router {
  const router = Router();

  router.use(authMiddleware);

  router.get("/", controller.list);
  router.get("/:id", controller.getById);
  router.get("/:id/pdf", controller.downloadPdf);

  router.post(
    "/draft",
    requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.SALES),
    controller.requestDraft
  );

  router.post(
    "/:id/recalculate",
    requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.SALES),
    controller.recalculate
  );

  router.post(
    "/:id/approve",
    requireRole(UserRole.OWNER, UserRole.MANAGER),
    controller.approve
  );

  router.post(
    "/:id/send",
    requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.SALES),
    controller.send
  );

  router.post(
    "/:id/confirm",
    requireRole(UserRole.OWNER, UserRole.MANAGER),
    controller.confirm
  );

  return router;
}

