import { Router } from "express";
import { ClientNotificationController } from "../controllers/client-notification.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";
import { validateParams, IdParamSchema } from "../validators/index.js";

export const clientNotificationRouter: Router = Router();
const controller = new ClientNotificationController();

clientNotificationRouter.use(authenticate);

clientNotificationRouter.get(
  "/",
  authorize("GET /api/v1/client/notifications"),
  controller.listNotifications
);

clientNotificationRouter.patch(
  "/:id/read",
  authorize("PATCH /api/v1/client/notifications/:id/read"),
  validateParams(IdParamSchema),
  controller.markAsRead
);

clientNotificationRouter.post(
  "/read-all",
  authorize("POST /api/v1/client/notifications/read-all"),
  controller.markAllAsRead
);

