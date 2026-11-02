import { Router } from "express";
import { SupervisorAdminController } from "../controllers/supervisor-admin.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";
import { validateQuery, SupervisorDailyReportQuerySchema } from "../validators/index.js";

export const supervisorAdminRouter: Router = Router();
const controller = new SupervisorAdminController();

supervisorAdminRouter.use(authenticate);

supervisorAdminRouter.get(
  "/",
  authorize("GET /api/v1/supervisor-reports"),
  validateQuery(SupervisorDailyReportQuerySchema),
  controller.listAllSupervisorReports
);
