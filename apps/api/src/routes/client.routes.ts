import { Router } from "express";
import { ClientController } from "../controllers/client.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";
import {
  validateBody,
  validateParams,
  IdParamSchema,
  ClientCreateSchema,
  ClientUpdateSchema,
} from "../validators/index.js";

export const clientRouter: Router = Router();
const controller = new ClientController();

clientRouter.use(authenticate);

clientRouter.get(
  "/",
  authorize("GET /api/v1/clients"),
  controller.listClients
);

clientRouter.post(
  "/",
  authorize("POST /api/v1/clients"),
  validateBody(ClientCreateSchema),
  controller.createClient
);

clientRouter.get(
  "/:id",
  authorize("GET /api/v1/clients/:id"),
  validateParams(IdParamSchema),
  controller.getClientById
);

clientRouter.patch(
  "/:id",
  authorize("PATCH /api/v1/clients/:id"),
  validateParams(IdParamSchema),
  validateBody(ClientUpdateSchema),
  controller.updateClient
);

clientRouter.delete(
  "/:id",
  authorize("DELETE /api/v1/clients/:id"),
  validateParams(IdParamSchema),
  controller.deleteClient
);

