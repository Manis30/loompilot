import { Router } from "express";
import { OrderController } from "../controllers/order.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";
import { idempotencyMiddleware } from "../middleware/idempotency.js";
import {
  validateBody,
  validateParams,
  IdParamSchema,
  AdminCreateOrderSchema,
  OrderDecisionSchema,
} from "../validators/index.js";

export const orderRouter: Router = Router();
const controller = new OrderController();

orderRouter.use(authenticate);

orderRouter.get(
  "/",
  authorize("GET /api/v1/orders"),
  controller.listOrders
);

orderRouter.get(
  "/:id",
  authorize("GET /api/v1/orders/:id"),
  validateParams(IdParamSchema),
  controller.getOrderById
);

orderRouter.post(
  "/",
  idempotencyMiddleware,
  authorize("POST /api/v1/orders"),
  validateBody(AdminCreateOrderSchema),
  controller.createOrder
);

orderRouter.post(
  "/:id/decide",
  authorize("POST /api/v1/orders/:id/decide"),
  validateParams(IdParamSchema),
  validateBody(OrderDecisionSchema),
  controller.decideOrder
);

orderRouter.post(
  "/:id/quotation/approve",
  authorize("POST /api/v1/orders/:id/quotation/approve"),
  validateParams(IdParamSchema),
  controller.approveQuotation
);

orderRouter.post(
  "/:id/quotation/send",
  idempotencyMiddleware,
  authorize("POST /api/v1/orders/:id/quotation/send"),
  validateParams(IdParamSchema),
  controller.sendQuotation
);
