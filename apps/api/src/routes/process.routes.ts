import { Router } from "express";
import { ProcessController } from "../controllers/process.controller.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { CreateProcessSchema } from "../validators/process.validator.js";
import { UserRole } from "@loompilot/shared";

export function createProcessRoutes(controller: ProcessController): Router {
  const router = Router();

  router.use(authMiddleware);

  router.get("/", controller.list);
  router.get("/:id", controller.getById);

  router.post(
    "/",
    requireRole(UserRole.OWNER, UserRole.MANAGER),
    validate(CreateProcessSchema),
    controller.create
  );

  return router;
}
