import { Router } from "express";
import { MeController } from "../controllers/me.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";

export const meRouter: Router = Router();

meRouter.use(authenticate);

meRouter.get(
  "/",
  authorize("GET /api/v1/me"),
  MeController.getMe
);

meRouter.patch(
  "/",
  authorize("PATCH /api/v1/me"),
  MeController.updateMe
);
