import { Router } from "express";
import { SettingsController } from "../controllers/settings.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";
import { validateBody, SettingsUpdateSchema } from "../validators/index.js";

export const settingsRouter: Router = Router();
const controller = new SettingsController();

settingsRouter.use(authenticate);

settingsRouter.get(
  "/",
  authorize("GET /api/v1/settings"),
  controller.getSettings
);

settingsRouter.patch(
  "/",
  authorize("PATCH /api/v1/settings"),
  validateBody(SettingsUpdateSchema),
  controller.updateSettings
);

