import { Router } from "express";
import { StockController } from "../controllers/stock.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";
import { idempotencyMiddleware } from "../middleware/idempotency.js";
import {
  validateBody,
  validateQuery,
  StockGoodsReceiptSchema,
  StockAdjustSchema,
  StockConsumeSchema,
  StockMovementQuerySchema,
  StockBalancesQuerySchema,
} from "../validators/index.js";

export const stockRouter: Router = Router();
const controller = new StockController();

stockRouter.use(authenticate);

stockRouter.post(
  "/receipt",
  idempotencyMiddleware,
  authorize("POST /api/v1/stock/receipt"),
  validateBody(StockGoodsReceiptSchema),
  controller.recordGoodsReceipt
);

stockRouter.post(
  "/adjust",
  authorize("POST /api/v1/stock/adjust"),
  validateBody(StockAdjustSchema),
  controller.adjustStock
);

stockRouter.post(
  "/consume",
  idempotencyMiddleware,
  authorize("POST /api/v1/stock/consume"),
  validateBody(StockConsumeSchema),
  controller.consumeStock
);

stockRouter.get(
  "/balances",
  authorize("GET /api/v1/stock/balances"),
  validateQuery(StockBalancesQuerySchema),
  controller.getStockBalances
);

stockRouter.get(
  "/movements",
  authorize("GET /api/v1/stock/movements"),
  validateQuery(StockMovementQuerySchema),
  controller.listMovements
);

stockRouter.get(
  "/summary",
  authorize("GET /api/v1/stock/summary"),
  controller.getStockSummary
);

