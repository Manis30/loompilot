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
  OrderAssignSupervisorsSchema,
  OrderHoldSchema,
  OrderCancelSchema,
  OrderCreatePaymentOrderSchema,
  OrderManualReceiptSchema,
  OrderReverseReceiptSchema,
  OrderDeliverySchema,
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

// Phase D: Handover, Controls, Payments & Deliveries
orderRouter.post(
  "/:id/assign",
  idempotencyMiddleware,
  authorize("POST /api/v1/orders/:id/assign"),
  validateParams(IdParamSchema),
  validateBody(OrderAssignSupervisorsSchema),
  controller.assignSupervisors
);

orderRouter.post(
  "/:id/start",
  idempotencyMiddleware,
  authorize("POST /api/v1/orders/:id/start"),
  validateParams(IdParamSchema),
  controller.startProduction
);

orderRouter.post(
  "/:id/hold",
  idempotencyMiddleware,
  authorize("POST /api/v1/orders/:id/hold"),
  validateParams(IdParamSchema),
  validateBody(OrderHoldSchema),
  controller.holdOrder
);

orderRouter.post(
  "/:id/resume",
  idempotencyMiddleware,
  authorize("POST /api/v1/orders/:id/resume"),
  validateParams(IdParamSchema),
  controller.resumeOrder
);

orderRouter.post(
  "/:id/cancel",
  idempotencyMiddleware,
  authorize("POST /api/v1/orders/:id/cancel"),
  validateParams(IdParamSchema),
  validateBody(OrderCancelSchema),
  controller.cancelOrder
);

orderRouter.post(
  "/:id/ready-for-delivery",
  idempotencyMiddleware,
  authorize("POST /api/v1/orders/:id/ready-for-delivery"),
  validateParams(IdParamSchema),
  controller.markReadyForDelivery
);

orderRouter.post(
  "/:id/payments/create-order",
  idempotencyMiddleware,
  authorize("POST /api/v1/orders/:id/payments/create-order"),
  validateParams(IdParamSchema),
  validateBody(OrderCreatePaymentOrderSchema),
  controller.createPaymentOrder
);

orderRouter.post(
  "/:id/payments/manual-receipt",
  idempotencyMiddleware,
  authorize("POST /api/v1/orders/:id/payments/manual-receipt"),
  validateParams(IdParamSchema),
  validateBody(OrderManualReceiptSchema),
  controller.recordManualReceipt
);

orderRouter.post(
  "/:id/payments/reverse",
  idempotencyMiddleware,
  authorize("POST /api/v1/orders/:id/payments/reverse"),
  validateParams(IdParamSchema),
  validateBody(OrderReverseReceiptSchema),
  controller.reverseReceipt
);

orderRouter.post(
  "/:id/deliveries",
  idempotencyMiddleware,
  authorize("POST /api/v1/orders/:id/deliveries"),
  validateParams(IdParamSchema),
  validateBody(OrderDeliverySchema),
  controller.recordDelivery
);
