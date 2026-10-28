import { Router } from "express";
import { MaterialController } from "./controller.js";
import { authMiddleware } from "../../middleware/auth.js";
import { requireRole, maskFinancialDataMiddleware } from "../../middleware/rbac.js";
import { UserRole } from "@loompilot/shared";

export const materialsRouter = Router();

materialsRouter.use(authMiddleware);
materialsRouter.use(maskFinancialDataMiddleware);

materialsRouter.get("/", MaterialController.list);
materialsRouter.get("/:id", MaterialController.getById);
materialsRouter.get("/:id/movements", MaterialController.getMovements);
materialsRouter.get("/:id/price-history", MaterialController.getPriceHistory);

materialsRouter.post(
  "/",
  requireRole(UserRole.OWNER, UserRole.MANAGER),
  MaterialController.create
);

materialsRouter.post(
  "/:id/movements",
  requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.STORE),
  MaterialController.recordMovement
);
