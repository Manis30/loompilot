import { Router } from "express";
import { ProductionController } from "../controllers/production.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";

export const productionRouter: Router = Router();
const controller = new ProductionController();

productionRouter.use(authenticate);

productionRouter.get(
  "/board",
  authorize("GET /api/v1/production/board"),
  controller.getProductionBoard
);
