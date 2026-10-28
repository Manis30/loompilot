import { Router } from "express";
import { OrderController } from "./controller.js";
import { authMiddleware } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { UserRole } from "@loompilot/shared";

export const ordersRouter = Router();

ordersRouter.use(authMiddleware);

ordersRouter.get("/", OrderController.list);
ordersRouter.get("/:id", OrderController.getById);
ordersRouter.get(
  "/:id/variance",
  requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.SALES),
  OrderController.getVariance
);

