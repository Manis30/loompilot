import { Router } from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { authLoginLimiter } from "../middleware/rateLimiter.js";
import {
  LoginSchema,
  RegisterUserSchema,
  ChangePasswordSchema,
} from "../validators/auth.validator.js";
import { UserRole } from "@loompilot/shared";

export function createAuthRoutes(controller: AuthController): Router {
  const router = Router();

  router.post("/login", authLoginLimiter, validate(LoginSchema), controller.login);
  router.post("/refresh", controller.refresh);
  router.post("/logout", authMiddleware, controller.logout);
  router.post("/logout-all", authMiddleware, controller.logoutAll);
  router.post("/change-password", authMiddleware, validate(ChangePasswordSchema), controller.changePassword);
  router.get("/me", authMiddleware, controller.me);

  // User registration: strictly authenticated OWNER-only within caller's tenant
  router.post(
    "/register",
    authMiddleware,
    requireRole(UserRole.OWNER),
    validate(RegisterUserSchema),
    controller.register
  );

  return router;
}
