import { Router } from "express";
import { MaterialController } from "../controllers/material.controller.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import {
  CreateMaterialSchema,
  UpdateMaterialSchema,
  RecordMovementSchema,
  UpdateRateSchema,
  BackfillPriceHistorySchema,
  GoodsReceiptSchema,
  StockAdjustmentSchema,
} from "../validators/material.validator.js";
import { UserRole } from "@loompilot/shared";

export function createMaterialRoutes(controller: MaterialController): Router {
  const router = Router();

  router.use(authMiddleware);

  // Stock summary placed before :id route
  router.get("/stock-summary", controller.getStockSummary);

  router.get("/", controller.list);
  router.get("/:id", controller.getById);
  router.get("/:id/movements", controller.getMovements);
  router.get("/:id/price-history", controller.getPriceHistory);

  router.post(
    "/",
    requireRole(UserRole.OWNER, UserRole.MANAGER),
    validate(CreateMaterialSchema),
    controller.create
  );

  router.patch(
    "/:id",
    requireRole(UserRole.OWNER, UserRole.MANAGER),
    validate(UpdateMaterialSchema),
    controller.update
  );

  router.post(
    "/:id/rate",
    requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.STORE),
    validate(UpdateRateSchema),
    controller.updateRate
  );

  router.post(
    "/:id/price-history",
    requireRole(UserRole.OWNER, UserRole.MANAGER),
    validate(BackfillPriceHistorySchema),
    controller.backfillPriceHistory
  );

  router.post(
    "/:id/receipt",
    requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.STORE),
    validate(GoodsReceiptSchema),
    controller.goodsReceipt
  );

  router.post(
    "/:id/adjust",
    requireRole(UserRole.OWNER, UserRole.MANAGER),
    validate(StockAdjustmentSchema),
    controller.stockAdjustment
  );

  router.post(
    "/:id/movements",
    requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.STORE),
    validate(RecordMovementSchema),
    controller.recordMovement
  );

  return router;
}
