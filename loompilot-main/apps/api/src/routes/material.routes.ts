import { Router } from "express";
import { MaterialController } from "../controllers/material.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";
import {
  validateBody,
  validateParams,
  IdParamSchema,
  MaterialCreateSchema,
  MaterialUpdateSchema,
  MaterialRateUpdateSchema,
  SupplierOffersUpdateSchema,
} from "../validators/index.js";

export const materialRouter: Router = Router();
const controller = new MaterialController();

materialRouter.use(authenticate);

materialRouter.get(
  "/",
  authorize("GET /api/v1/materials"),
  controller.listMaterials
);

materialRouter.post(
  "/",
  authorize("POST /api/v1/materials"),
  validateBody(MaterialCreateSchema),
  controller.createMaterial
);

materialRouter.get(
  "/:id",
  authorize("GET /api/v1/materials/:id"),
  validateParams(IdParamSchema),
  controller.getMaterialById
);

materialRouter.patch(
  "/:id",
  authorize("PATCH /api/v1/materials/:id"),
  validateParams(IdParamSchema),
  validateBody(MaterialUpdateSchema),
  controller.updateMaterial
);

materialRouter.delete(
  "/:id",
  authorize("DELETE /api/v1/materials/:id"),
  validateParams(IdParamSchema),
  controller.deleteMaterial
);

materialRouter.post(
  "/:id/rate",
  authorize("POST /api/v1/materials/:id/rate"),
  validateParams(IdParamSchema),
  validateBody(MaterialRateUpdateSchema),
  controller.updateRate
);

materialRouter.post(
  "/:id/offers",
  authorize("POST /api/v1/materials/:id/offers"),
  validateParams(IdParamSchema),
  validateBody(SupplierOffersUpdateSchema),
  controller.updateSupplierOffers
);

