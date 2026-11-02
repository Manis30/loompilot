import { Router } from "express";
import { AdminAssistantController } from "../controllers/admin-assistant.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";
import { AppContainer } from "../container.js";

export function createAdminAssistantRouter(container: AppContainer): Router {
  const router = Router();
  const controller = new AdminAssistantController(container.agentsClient);

  router.post(
    "/api/v1/admin/assistant/ask",
    authenticate,
    authorize("POST /api/v1/admin/assistant/ask"),
    controller.ask
  );

  return router;
}
