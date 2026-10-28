import { Router } from "express";
import { OrderController } from "../controllers/order.controller.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { UserRole } from "@loompilot/shared";

export function createOrderRoutes(controller: OrderController): Router {
  const router = Router();

  router.use(authMiddleware);

  router.get("/", controller.list);
  router.get("/:id", controller.getById);
  router.get(
    "/:id/variance",
    requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.SALES),
    controller.getVariance
  );

  return router;
}

