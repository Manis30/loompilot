import { Router } from "express";
import { MaintenanceTicketController } from "../controllers/maintenance-ticket.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";
import {
  validateBody,
  validateParams,
  validateQuery,
  IdParamSchema,
  MaintenanceTicketCreateSchema,
  MaintenanceTicketUpdateSchema,
  MaintenanceTicketQuerySchema,
} from "../validators/index.js";

export const maintenanceTicketRouter: Router = Router();
const controller = new MaintenanceTicketController();

maintenanceTicketRouter.use(authenticate);

maintenanceTicketRouter.post(
  "/",
  authorize("POST /api/v1/maintenance-tickets"),
  validateBody(MaintenanceTicketCreateSchema),
  controller.createTicket
);

maintenanceTicketRouter.get(
  "/",
  authorize("GET /api/v1/maintenance-tickets"),
  validateQuery(MaintenanceTicketQuerySchema),
  controller.listTickets
);

maintenanceTicketRouter.get(
  "/:id",
  authorize("GET /api/v1/maintenance-tickets/:id"),
  validateParams(IdParamSchema),
  controller.getTicketById
);

maintenanceTicketRouter.patch(
  "/:id",
  authorize("PATCH /api/v1/maintenance-tickets/:id"),
  validateParams(IdParamSchema),
  validateBody(MaintenanceTicketUpdateSchema),
  controller.updateTicket
);
