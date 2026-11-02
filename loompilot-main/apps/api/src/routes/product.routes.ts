import { Router } from "express";
import { ProductController } from "../controllers/product.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";
import {
  validateBody,
  validateParams,
  validateQuery,
  IdParamSchema,
  ProductCreateSchema,
  ProductUpdateSchema,
  ProductImageSchema,
  ProductQuerySchema,
} from "../validators/index.js";

export const productRouter: Router = Router();
const controller = new ProductController();

productRouter.use(authenticate);

productRouter.get(
  "/",
  authorize("GET /api/v1/products"),
  validateQuery(ProductQuerySchema),
  controller.listProducts
);

productRouter.post(
  "/",
  authorize("POST /api/v1/products"),
  validateBody(ProductCreateSchema),
  controller.createProduct
);

productRouter.get(
  "/:id",
  authorize("GET /api/v1/products/:id"),
  validateParams(IdParamSchema),
  controller.getProductById
);

productRouter.patch(
  "/:id",
  authorize("PATCH /api/v1/products/:id"),
  validateParams(IdParamSchema),
  validateBody(ProductUpdateSchema),
  controller.updateProduct
);

productRouter.delete(
  "/:id",
  authorize("DELETE /api/v1/products/:id"),
  validateParams(IdParamSchema),
  controller.deleteProduct
);

productRouter.post(
  "/:id/images",
  authorize("POST /api/v1/products/:id/images"),
  validateParams(IdParamSchema),
  validateBody(ProductImageSchema),
  controller.addProductImage
);

