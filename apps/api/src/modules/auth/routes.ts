import { Router } from "express";
import { AuthController } from "./controller.js";
import { authMiddleware } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { LoginRequestSchema } from "@loompilot/shared";

export const authRouter = Router();

authRouter.post("/login", validate(LoginRequestSchema), AuthController.login);
authRouter.post("/refresh", AuthController.refresh);
authRouter.post("/logout", authMiddleware, AuthController.logout);
authRouter.get("/me", authMiddleware, AuthController.me);

