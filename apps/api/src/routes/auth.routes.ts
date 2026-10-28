import { Router } from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { authMiddleware } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { LoginSchema } from "../validators/auth.validator.js";

export function createAuthRoutes(controller: AuthController): Router {
  const router = Router();

  router.post("/login", validate(LoginSchema), controller.login);
  router.post("/refresh", controller.refresh);
  router.post("/logout", authMiddleware, controller.logout);
  router.get("/me", authMiddleware, controller.me);

  return router;
}
