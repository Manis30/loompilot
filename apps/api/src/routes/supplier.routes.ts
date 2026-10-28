import { Router } from "express";
import { SupplierController } from "../controllers/supplier.controller.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { CreateSupplierSchema } from "../validators/supplier.validator.js";
import { UserRole } from "@loompilot/shared";

export function createSupplierRoutes(controller: SupplierController): Router {
  const router = Router();

  router.use(authMiddleware);

  router.get("/", controller.list);
  router.get("/:id", controller.getById);

  router.post(
    "/",
    requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.STORE),
    validate(CreateSupplierSchema),
    controller.create
  );

  return router;
}
