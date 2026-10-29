import { Router } from "express";
import { SettingsController } from "../controllers/settings.controller.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import {
  UpdateSettingsSchema,
  CreateHolidaySchema,
} from "../validators/settings.validator.js";
import { UserRole } from "@loompilot/shared";

export function createSettingsRoutes(controller: SettingsController): Router {
  const router = Router();

  router.use(authMiddleware);

  // Settings
  router.get("/", controller.getSettings);
  router.patch("/", requireRole(UserRole.OWNER), validate(UpdateSettingsSchema), controller.updateSettings);

  // Holidays
  router.get("/holidays", requireRole(UserRole.OWNER, UserRole.MANAGER), controller.listHolidays);
  router.post(
    "/holidays",
    requireRole(UserRole.OWNER, UserRole.MANAGER),
    validate(CreateHolidaySchema),
    controller.createHoliday
  );
  router.delete(
    "/holidays/:id",
    requireRole(UserRole.OWNER, UserRole.MANAGER),
    controller.deleteHoliday
  );

  return router;
}
