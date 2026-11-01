import { Router } from "express";
import { ClientOrderController } from "../controllers/client-order.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";
import { idempotencyMiddleware } from "../middleware/idempotency.js";
import {
  validateBody,
  validateParams,
  validateQuery,
  IdParamSchema,
  OrderMilestoneParamSchema,
  ClientSubmitOrderSchema,
  ClientAcceptQuotationSchema,
  ClientDeclineQuotationSchema,
  OrderQuerySchema,
} from "../validators/index.js";

export const clientOrderRouter: Router = Router();
const controller = new ClientOrderController();

clientOrderRouter.use(authenticate);

clientOrderRouter.post(
  "/",
  idempotencyMiddleware,
  authorize("POST /api/v1/client/orders"),
  validateBody(ClientSubmitOrderSchema),
  controller.submitOrder
);

clientOrderRouter.get(
  "/",
  authorize("GET /api/v1/client/orders"),
  validateQuery(OrderQuerySchema),
  controller.listOrders
);

clientOrderRouter.get(
  "/:id",
  authorize("GET /api/v1/client/orders/:id"),
  validateParams(IdParamSchema),
  controller.getOrderById
);

clientOrderRouter.post(
  "/:id/quotation/accept",
  idempotencyMiddleware,
  authorize("POST /api/v1/client/orders/:id/quotation/accept"),
  validateParams(IdParamSchema),
  validateBody(ClientAcceptQuotationSchema),
  controller.acceptQuotation
);

clientOrderRouter.post(
  "/:id/quotation/decline",
  idempotencyMiddleware,
  authorize("POST /api/v1/client/orders/:id/quotation/decline"),
  validateParams(IdParamSchema),
  validateBody(ClientDeclineQuotationSchema),
  controller.declineQuotation
);

clientOrderRouter.post(
  "/:id/payments/:milestoneIndex/razorpay-order",
  idempotencyMiddleware,
  authorize("POST /api/v1/client/orders/:id/payments/:milestoneIndex/razorpay-order"),
  validateParams(OrderMilestoneParamSchema),
  controller.createPaymentOrder
);
