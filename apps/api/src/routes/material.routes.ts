import { Router } from "express";
import { MaterialController } from "../controllers/material.controller.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { CreateMaterialSchema, RecordMovementSchema } from "../validators/material.validator.js";
import { UserRole } from "@loompilot/shared";

export function createMaterialRoutes(controller: MaterialController): Router {
  const router = Router();

  router.use(authMiddleware);

  router.get("/", controller.list);
  router.get("/:id", controller.getById);
  router.get("/:id/movements", controller.getMovements);
  router.get("/:id/price-history", controller.getPriceHistory);

  router.post(
    "/",
    requireRole(UserRole.OWNER, UserRole.MANAGER),
    validate(CreateMaterialSchema),
    controller.create
  );

  router.post(
    "/:id/movements",
    requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.STORE),
    validate(RecordMovementSchema),
    controller.recordMovement
  );

  return router;
}
