import { Router } from "express";
import { MarketPriceController } from "../controllers/market-price.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";

export const marketPriceRouter: Router = Router();
const controller = new MarketPriceController();

marketPriceRouter.use(authenticate);

marketPriceRouter.get(
  "/",
  authorize("GET /api/v1/market-prices"),
  controller.getMarketPrices
);

marketPriceRouter.post(
  "/trigger-surge-reprice",
  authorize("POST /api/v1/market-prices/trigger-surge-reprice"),
  controller.triggerSurgeReprice
);

