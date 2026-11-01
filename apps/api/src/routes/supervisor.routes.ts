import { Router } from "express";
import { SupervisorController } from "../controllers/supervisor.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";
import {
  validateBody,
  validateParams,
  validateQuery,
  IdParamSchema,
  paginationQuerySchema,
  SupervisorDailyReportSubmitSchema,
  SupervisorDailyReportQuerySchema,
  SupervisorDailyReportCorrectionSchema,
  SupervisorNotificationQuerySchema,
} from "../validators/index.js";

export const supervisorRouter: Router = Router();
const controller = new SupervisorController();

supervisorRouter.use(authenticate);

supervisorRouter.get(
  "/orders",
  authorize("GET /api/v1/supervisor/orders"),
  validateQuery(paginationQuerySchema),
  controller.listAssignedOrders
);

supervisorRouter.post(
  "/reports",
  authorize("POST /api/v1/supervisor/reports"),
  validateBody(SupervisorDailyReportSubmitSchema),
  controller.submitReport
);

supervisorRouter.get(
  "/reports",
  authorize("GET /api/v1/supervisor/reports"),
  validateQuery(SupervisorDailyReportQuerySchema),
  controller.listReports
);

supervisorRouter.get(
  "/reports/:id",
  authorize("GET /api/v1/supervisor/reports/:id"),
  validateParams(IdParamSchema),
  controller.getReportById
);

supervisorRouter.patch(
  "/reports/:id",
  authorize("PATCH /api/v1/supervisor/reports/:id"),
  validateParams(IdParamSchema),
  validateBody(SupervisorDailyReportCorrectionSchema),
  controller.correctReport
);

supervisorRouter.get(
  "/notifications",
  authorize("GET /api/v1/supervisor/notifications"),
  validateQuery(SupervisorNotificationQuerySchema),
  controller.listNotifications
);

supervisorRouter.patch(
  "/notifications/:id/read",
  authorize("PATCH /api/v1/supervisor/notifications/:id/read"),
  validateParams(IdParamSchema),
  controller.markNotificationAsRead
);
