import { Router } from "express";
import jwt from "jsonwebtoken";
import { AuthController } from "../controllers/auth.controller.js";
import { authMiddleware } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { LoginSchema, RegisterUserSchema } from "../validators/auth.validator.js";
import { env } from "../config/env.js";

export function createAuthRoutes(controller: AuthController): Router {
  const router = Router();

  router.post("/login", validate(LoginSchema), controller.login);
  router.post("/refresh", controller.refresh);
  router.post("/logout", authMiddleware, controller.logout);
  router.get("/me", authMiddleware, controller.me);

  // User creation: owner-only in existing tenant, or first owner bootstrap in new tenant
  router.post(
    "/register",
    validate(RegisterUserSchema),
    (req, _res, next) => {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        try {
          const token = authHeader.substring(7);
          const payload = jwt.verify(token, env.JWT_SECRET) as any;
          req.user = payload;
        } catch {
          // Token invalid, req.user remains undefined
        }
      }
      next();
    },
    controller.register
  );

  return router;
}

