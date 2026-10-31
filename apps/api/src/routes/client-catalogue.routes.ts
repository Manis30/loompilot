import { Router } from "express";
import { ProductController } from "../controllers/product.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";
import { validateParams, IdParamSchema } from "../validators/index.js";

export const clientCatalogueRouter: Router = Router();
const controller = new ProductController();

clientCatalogueRouter.use(authenticate);

clientCatalogueRouter.get(
  "/products",
  authorize("GET /api/v1/client/products"),
  controller.listClientCatalogue
);

clientCatalogueRouter.get(
  "/products/:id",
  authorize("GET /api/v1/client/products/:id"),
  validateParams(IdParamSchema),
  controller.getClientCatalogueItem
);

