import { Router } from "express";
import { SupplierController } from "./controller.js";
import { authMiddleware } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { UserRole } from "@loompilot/shared";

export const suppliersRouter = Router();

suppliersRouter.use(authMiddleware);

suppliersRouter.get("/", SupplierController.list);
suppliersRouter.get("/:id", SupplierController.getById);
suppliersRouter.post(
  "/",
  requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.STORE),
  SupplierController.create
);
