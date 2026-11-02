import { Router } from "express";
import { ProcurementController } from "../controllers/procurement.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";
import {
  validateQuery,
  validateBody,
  validateParams,
  IdParamSchema,
  PurchaseDecisionQuerySchema,
  PurchaseRequestDirectCreateSchema,
  PurchaseDecisionUpdateSchema,
} from "../validators/index.js";

export const procurementRouter: Router = Router();
const controller = new ProcurementController();

procurementRouter.use(authenticate);

procurementRouter.get(
  "/",
  authorize("GET /api/v1/purchase-decisions"),
  validateQuery(PurchaseDecisionQuerySchema),
  controller.listPurchaseDecisions
);

procurementRouter.post(
  "/",
  authorize("POST /api/v1/purchase-decisions"),
  validateBody(PurchaseRequestDirectCreateSchema),
  controller.createPurchaseDecision
);

procurementRouter.patch(
  "/:id",
  authorize("PATCH /api/v1/purchase-decisions/:id"),
  validateParams(IdParamSchema),
  validateBody(PurchaseDecisionUpdateSchema),
  controller.updatePurchaseDecision
);
