import { Request, Response, NextFunction } from "express";
import { OrderService } from "../services/order.service.js";
import { parsePaginationQuery } from "../utils/pagination.js";

export class OrderController {
  constructor(private readonly orderService = new OrderService()) {}

  listOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const pagination = parsePaginationQuery(req.query as any);

      const result = await this.orderService.listOrders({
        tenantId: actor.tenantId,
        pagination,
        isClient: false,
        filter: {
          status: req.query.status as string | undefined,
          clientId: req.query.clientId as string | undefined,
          productId: req.query.productId as string | undefined,
          search: req.query.search as string | undefined,
          fromDate: (req.query.fromDate || req.query.createdFrom) as string | undefined,
          toDate: (req.query.toDate || req.query.createdTo) as string | undefined,
          deliveryFrom: (req.query.deliveryFrom || req.query.deadlineFrom) as string | undefined,
          deliveryTo: (req.query.deliveryTo || req.query.deadlineTo) as string | undefined,
        },
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  getOrderById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;

      const result = await this.orderService.getOrderById({
        tenantId: actor.tenantId,
        orderId: req.params.id as string,
        isClient: actor.realm === "client",
        clientId: actor.clientId,
        role: actor.role,
        supervisorId: actor.role === "supervisor" ? actor.subjectId : undefined,
      });

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  updateOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;

      const result = await this.orderService.updateOrder({
        tenantId: actor.tenantId,
        orderId: req.params.id as string,
        data: req.body,
        actor: {
          id: actor.subjectId,
          email: actor.email,
          ip: req.ip,
          requestId: actor.requestId,
          type: "user",
        },
      });

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  createOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;

      const result = await this.orderService.submitOrder({
        tenantId: actor.tenantId,
        clientId: req.body.clientId,
        ...req.body,
        actor: {
          id: actor.subjectId,
          email: actor.email,
          ip: req.ip,
          requestId: actor.requestId,
          type: "user",
        },
      });

      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  decideOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;

      const result = await this.orderService.decideOrder({
        tenantId: actor.tenantId,
        orderId: req.params.id as string,
        decision: req.body.decision,
        alternativeId: req.body.alternativeId,
        purchaseDecision: req.body.purchaseDecision,
        notes: req.body.notes,
        actor: {
          id: actor.subjectId,
          email: actor.email,
          ip: req.ip,
          requestId: actor.requestId,
        },
      });

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  approveQuotation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;

      const result = await this.orderService.approveQuotation({
        tenantId: actor.tenantId,
        orderId: req.params.id as string,
        action: req.body?.action,
        editedMarginPercent: req.body?.editedMarginPercent,
        editedDeliveryDate: req.body?.editedDeliveryDate,
        unitPricePaise: req.body?.unitPricePaise,
        totalPaise: req.body?.totalPaise,
        lineItems: req.body?.lineItems,
        paymentSchedule: req.body?.paymentSchedule,
        notes: req.body?.notes,
        reason: req.body?.reason,
        recalculateReason: req.body?.recalculateReason,
        actor: {
          id: actor.subjectId,
          email: actor.email,
          ip: req.ip,
          requestId: actor.requestId,
        },
      });

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  sendQuotation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;

      const result = await this.orderService.sendQuotation({
        tenantId: actor.tenantId,
        orderId: req.params.id as string,
        idempotencyKey: req.headers["idempotency-key"] as string | undefined,
        actor: {
          id: actor.subjectId,
          email: actor.email,
          ip: req.ip,
          requestId: actor.requestId,
        },
      });

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  assignSupervisors = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;

      const result = await this.orderService.assignSupervisors({
        tenantId: actor.tenantId,
        orderId: req.params.id as string,
        assignments: req.body.assignments,
        overrideReason: req.body.overrideReason,
        notes: req.body.notes,
        actor: {
          id: actor.subjectId,
          email: actor.email,
          ip: req.ip,
          requestId: actor.requestId,
          type: "user",
        },
      });

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  startProduction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;

      const result = await this.orderService.startProduction({
        tenantId: actor.tenantId,
        orderId: req.params.id as string,
        actor: {
          id: actor.subjectId,
          email: actor.email,
          ip: req.ip,
          requestId: actor.requestId,
          role: actor.role as any,
        },
      });

      if (actor.role === "supervisor") {
        res.json({
          data: {
            id: String(result._id || result.id),
            status: result.status,
            assignmentStatus: result.production?.assignmentStatus || "started",
          },
        });
        return;
      }

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  holdOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;

      const result = await this.orderService.holdOrder({
        tenantId: actor.tenantId,
        orderId: req.params.id as string,
        reason: req.body.reason,
        actor: {
          id: actor.subjectId,
          email: actor.email,
          ip: req.ip,
          requestId: actor.requestId,
          type: "user",
        },
      });

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  resumeOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;

      const result = await this.orderService.resumeOrder({
        tenantId: actor.tenantId,
        orderId: req.params.id as string,
        actor: {
          id: actor.subjectId,
          email: actor.email,
          ip: req.ip,
          requestId: actor.requestId,
          type: "user",
        },
      });

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  cancelOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;

      const result = await this.orderService.cancelOrder({
        tenantId: actor.tenantId,
        orderId: req.params.id as string,
        reason: req.body.reason,
        actor: {
          id: actor.subjectId,
          email: actor.email,
          ip: req.ip,
          requestId: actor.requestId,
          type: "user",
        },
      });

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  markReadyForDelivery = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;

      const result = await this.orderService.markReadyForDelivery({
        tenantId: actor.tenantId,
        orderId: req.params.id as string,
        actor: {
          id: actor.subjectId,
          email: actor.email,
          ip: req.ip,
          requestId: actor.requestId,
          type: "user",
        },
      });

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  createPaymentOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;

      const result = await this.orderService.createPaymentOrder({
        tenantId: actor.tenantId,
        orderId: req.params.id as string,
        milestoneIndex: req.body.milestoneIndex !== undefined ? Number(req.body.milestoneIndex) : undefined,
        notes: req.body.notes,
        isClient: false,
      });

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  recordManualReceipt = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;

      const result = await this.orderService.recordManualReceipt({
        tenantId: actor.tenantId,
        orderId: req.params.id as string,
        milestoneIndex: Number(req.body.milestoneIndex),
        amountPaise: Number(req.body.amountPaise),
        method: req.body.method,
        mode: req.body.mode,
        ref: req.body.ref,
        date: req.body.date,
        notes: req.body.notes,
        actor: {
          id: actor.subjectId,
          email: actor.email,
          ip: req.ip,
          requestId: actor.requestId,
          type: "user",
        },
      });

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  reverseReceipt = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;

      const result = await this.orderService.reverseReceipt({
        tenantId: actor.tenantId,
        orderId: req.params.id as string,
        milestoneIndex: Number(req.body.milestoneIndex),
        receiptIndex: req.body.receiptIndex !== undefined ? Number(req.body.receiptIndex) : undefined,
        receiptRef: req.body.receiptRef,
        reason: req.body.reason,
        actor: {
          id: actor.subjectId,
          email: actor.email,
          ip: req.ip,
          requestId: actor.requestId,
          type: "user",
        },
      });

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  recordDelivery = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;

      const result = await this.orderService.recordDelivery({
        tenantId: actor.tenantId,
        orderId: req.params.id as string,
        deliveryDate: req.body.deliveryDate,
        qty: Number(req.body.qty),
        invoiceNo: req.body.invoiceNo,
        invoiceAmountPaise: Number(req.body.invoiceAmountPaise),
        notes: req.body.notes,
        actor: {
          id: actor.subjectId,
          email: actor.email,
          ip: req.ip,
          requestId: actor.requestId,
          type: "user",
        },
      });

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };
}
