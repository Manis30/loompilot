import { Router } from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { authRateLimiter } from "../middleware/auth-rate-limiter.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";
import { idempotencyMiddleware } from "../middleware/idempotency.js";

export const authRouter: Router = Router();

// 1. Staff Authentication
authRouter.post(
  "/auth/login",
  authRateLimiter,
  authorize("POST /api/v1/auth/login"),
  AuthController.loginUser
);

authRouter.post(
  "/auth/refresh",
  authRateLimiter,
  authorize("POST /api/v1/auth/refresh"),
  AuthController.refreshUser
);

authRouter.post(
  "/auth/logout",
  authorize("POST /api/v1/auth/logout"),
  AuthController.logoutUser
);

authRouter.post(
  "/auth/logout-all",
  authenticate,
  authorize("POST /api/v1/auth/logout-all"),
  AuthController.logoutAll
);

authRouter.post(
  "/auth/change-password",
  authenticate,
  authorize("POST /api/v1/auth/change-password"),
  AuthController.changePassword
);

// 2. Client Authentication
authRouter.post(
  "/client/auth/login",
  authRateLimiter,
  authorize("POST /api/v1/client/auth/login"),
  AuthController.loginClient
);

authRouter.post(
  "/client/auth/refresh",
  authRateLimiter,
  authorize("POST /api/v1/client/auth/refresh"),
  AuthController.refreshClient
);

authRouter.post(
  "/client/auth/logout",
  authorize("POST /api/v1/client/auth/logout"),
  AuthController.logoutClient
);

authRouter.post(
  "/client/auth/logout-all",
  authenticate,
  authorize("POST /api/v1/client/auth/logout-all"),
  AuthController.logoutAll
);

authRouter.post(
  "/client/auth/accept-invite",
  authRateLimiter,
  idempotencyMiddleware,
  authorize("POST /api/v1/client/auth/accept-invite"),
  AuthController.acceptInvite
);
