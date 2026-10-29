import { Router } from "express";
import { CustomerController } from "../controllers/customer.controller.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import {
  CreateCustomerSchema,
  UpdateCustomerSchema,
} from "../validators/customer.validator.js";
import { UserRole } from "@loompilot/shared";

export function createCustomerRoutes(controller: CustomerController): Router {
  const router = Router();

  router.use(authMiddleware);

  router.get("/", controller.list);
  router.get("/:id", controller.getById);
  router.post(
    "/",
    requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.SALES),
    validate(CreateCustomerSchema),
    controller.create
  );
  router.patch(
    "/:id",
    requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.SALES),
    validate(UpdateCustomerSchema),
    controller.update
  );

  return router;
}

