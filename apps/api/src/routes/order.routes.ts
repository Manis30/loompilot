import { Router } from "express";
import { OrderController } from "../controllers/order.controller.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { IssueMaterialsSchema } from "../validators/order.validator.js";
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
  router.get(
    "/:id/costs",
    requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTS),
    controller.getOrderCosts
  );
  router.post(
    "/:id/issue-materials",
    requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.STORE),
    validate(IssueMaterialsSchema),
    controller.issueMaterials
  );

  return router;
}

