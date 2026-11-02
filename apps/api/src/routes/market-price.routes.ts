import { Router } from "express";
import { MarketPriceController } from "../controllers/market-price.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";
import { AppContainer } from "../container.js";

export function createMarketPriceRouter(container: AppContainer): Router {
  const router = Router();
  const controller = new MarketPriceController(container.agentsClient);

  router.get(
    "/api/v1/market-prices",
    authenticate,
    authorize("GET /api/v1/market-prices"),
    controller.getMarketPrices
  );

  router.get(
    "/api/v1/market-prices/alerts",
    authenticate,
    authorize("GET /api/v1/market-prices/alerts"),
    controller.getSurgeAlerts
  );

  router.post(
    "/api/v1/market-prices/trigger-requote",
    authenticate,
    authorize("POST /api/v1/market-prices/trigger-requote"),
    controller.triggerRequote
  );

  return router;
}
