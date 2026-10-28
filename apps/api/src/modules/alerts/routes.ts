import { Router } from "express";
import { AlertController } from "./controller.js";
import { authMiddleware } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { UserRole } from "@loompilot/shared";

export const alertsRouter = Router();

alertsRouter.use(authMiddleware);

alertsRouter.get("/", AlertController.listAlerts);
alertsRouter.post(
  "/:id/ack",
  requireRole(UserRole.OWNER, UserRole.MANAGER),
  AlertController.acknowledgeAlert
);

alertsRouter.get("/recommendations", AlertController.listRecommendations);
alertsRouter.post(
  "/recommendations/:id/decide",
  requireRole(UserRole.OWNER, UserRole.MANAGER),
  AlertController.decideRecommendation
);
