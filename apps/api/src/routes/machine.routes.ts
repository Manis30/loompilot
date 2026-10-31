import { Router } from "express";
import { MachineController } from "../controllers/machine.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";
import {
  validateBody,
  validateParams,
  IdParamSchema,
  MachineCreateSchema,
  MachineUpdateSchema,
} from "../validators/index.js";

export const machineRouter: Router = Router();
const controller = new MachineController();

machineRouter.use(authenticate);

machineRouter.get(
  "/",
  authorize("GET /api/v1/machines"),
  controller.listMachines
);

machineRouter.post(
  "/",
  authorize("POST /api/v1/machines"),
  validateBody(MachineCreateSchema),
  controller.createMachine
);

machineRouter.get(
  "/:id",
  authorize("GET /api/v1/machines/:id"),
  validateParams(IdParamSchema),
  controller.getMachineById
);

machineRouter.patch(
  "/:id",
  authorize("PATCH /api/v1/machines/:id"),
  validateParams(IdParamSchema),
  validateBody(MachineUpdateSchema),
  controller.updateMachine
);

machineRouter.delete(
  "/:id",
  authorize("DELETE /api/v1/machines/:id"),
  validateParams(IdParamSchema),
  controller.deleteMachine
);

