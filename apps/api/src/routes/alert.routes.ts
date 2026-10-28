import { Router } from "express";
import { AlertController } from "../controllers/alert.controller.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { DecideRecommendationSchema } from "../validators/alert.validator.js";
import { UserRole } from "@loompilot/shared";

export function createAlertRoutes(controller: AlertController): Router {
  const router = Router();

  router.use(authMiddleware);

  router.get("/", controller.listAlerts);
  router.post(
    "/:id/ack",
    requireRole(UserRole.OWNER, UserRole.MANAGER),
    controller.acknowledgeAlert
  );

  router.get("/recommendations", controller.listRecommendations);
  router.post(
    "/recommendations/:id/decide",
    requireRole(UserRole.OWNER, UserRole.MANAGER),
    validate(DecideRecommendationSchema),
    controller.decideRecommendation
  );

  return router;
}
