import { Router } from "express";
import { UserController } from "../controllers/user.controller.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import {
  CreateUserSchema,
  UpdateUserSchema,
  ResetPasswordSchema,
} from "../validators/user.validator.js";
import { UserRole } from "@loompilot/shared";

export function createUserRoutes(controller: UserController): Router {
  const router = Router();

  router.use(authMiddleware);

  // List users in caller's tenant: OWNER, MANAGER
  router.get("/", requireRole(UserRole.OWNER, UserRole.MANAGER), controller.list);

  // Create user in caller's tenant: OWNER only
  router.post("/", requireRole(UserRole.OWNER), validate(CreateUserSchema), controller.create);

  // Update user in caller's tenant: OWNER only
  router.patch("/:id", requireRole(UserRole.OWNER), validate(UpdateUserSchema), controller.update);

  // Reset user's password: OWNER only
  router.post(
    "/:id/reset-password",
    requireRole(UserRole.OWNER),
    validate(ResetPasswordSchema),
    controller.resetPassword
  );

  return router;
}

