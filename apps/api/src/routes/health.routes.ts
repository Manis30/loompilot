import { Router } from "express";
import { HealthController } from "../controllers/health.controller.js";

export function createHealthRoutes(healthController: HealthController): Router {
  const router = Router();

  router.get("/health", healthController.getHealth);
  router.get("/ready", healthController.getReadiness);

  return router;
}

