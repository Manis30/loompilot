import { Router } from "express";
import { DeliveryController } from "../controllers/delivery.controller.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { idempotencyMiddleware } from "../middleware/idempotency.js";
import { RecordDeliverySchema } from "../validators/delivery.validator.js";
import { UserRole } from "@loompilot/shared";

export function createDeliveryRoutes(controller: DeliveryController): Router {
  const router = Router();

  router.use(authMiddleware);

  router.get("/", controller.list);
  router.get("/:id", controller.getById);

  router.post(
    "/",
    requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.STORE),
    validate(RecordDeliverySchema),
    idempotencyMiddleware(),
    controller.recordDelivery
  );

  return router;
}

