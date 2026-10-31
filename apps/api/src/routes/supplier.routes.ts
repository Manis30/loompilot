import { Router } from "express";
import { SupplierController } from "../controllers/supplier.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";
import {
  validateBody,
  validateParams,
  IdParamSchema,
  SupplierCreateSchema,
  SupplierUpdateSchema,
} from "../validators/index.js";

export const supplierRouter: Router = Router();
const controller = new SupplierController();

supplierRouter.use(authenticate);

supplierRouter.get(
  "/",
  authorize("GET /api/v1/suppliers"),
  controller.listSuppliers
);

supplierRouter.post(
  "/",
  authorize("POST /api/v1/suppliers"),
  validateBody(SupplierCreateSchema),
  controller.createSupplier
);

supplierRouter.get(
  "/:id",
  authorize("GET /api/v1/suppliers/:id"),
  validateParams(IdParamSchema),
  controller.getSupplierById
);

supplierRouter.patch(
  "/:id",
  authorize("PATCH /api/v1/suppliers/:id"),
  validateParams(IdParamSchema),
  validateBody(SupplierUpdateSchema),
  controller.updateSupplier
);

supplierRouter.delete(
  "/:id",
  authorize("DELETE /api/v1/suppliers/:id"),
  validateParams(IdParamSchema),
  controller.deleteSupplier
);

