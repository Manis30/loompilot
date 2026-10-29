import { Router } from "express";
import { ProductController } from "../controllers/product.controller.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import {
  CreateProductSchema,
  UpdateProductSchema,
  CreateBomSchema,
} from "../validators/product.validator.js";
import { UserRole } from "@loompilot/shared";

export function createProductRoutes(controller: ProductController): Router {
  const router = Router();

  router.use(authMiddleware);

  // Products CRUD
  router.get("/", controller.list);
  router.get("/:id", controller.getById);
  router.post(
    "/",
    requireRole(UserRole.OWNER, UserRole.MANAGER),
    validate(CreateProductSchema),
    controller.create
  );
  router.patch(
    "/:id",
    requireRole(UserRole.OWNER, UserRole.MANAGER),
    validate(UpdateProductSchema),
    controller.update
  );

  // BOM
  router.get("/:id/bom", controller.getActiveBom);
  router.get("/:id/bom/versions", controller.listBoms);
  router.post(
    "/:id/bom",
    requireRole(UserRole.OWNER, UserRole.MANAGER),
    validate(CreateBomSchema),
    controller.createBom
  );

  return router;
}
