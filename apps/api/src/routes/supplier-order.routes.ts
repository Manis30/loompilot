import { Router } from "express";
import { SupplierOrderController } from "../controllers/supplier-order.controller.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import {
  CreateSupplierOrderSchema,
  UpdateSupplierOrderSchema,
  ReceiveSupplierOrderSchema,
} from "../validators/supplier-order.validator.js";
import { UserRole } from "@loompilot/shared";

export function createSupplierOrderRoutes(
  controller: SupplierOrderController
): Router {
  const router = Router();

  router.use(authMiddleware);

  router.get("/", controller.list);
  router.post(
    "/",
    requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.STORE),
    validate(CreateSupplierOrderSchema),
    controller.create
  );
  router.get("/:id", controller.getById);
  router.patch(
    "/:id",
    requireRole(UserRole.OWNER, UserRole.MANAGER),
    validate(UpdateSupplierOrderSchema),
    controller.update
  );
  router.post(
    "/:id/receive",
    requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.STORE),
    validate(ReceiveSupplierOrderSchema),
    controller.receive
  );

  return router;
}

