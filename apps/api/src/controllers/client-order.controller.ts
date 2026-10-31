import { Request, Response, NextFunction } from "express";
import { OrderService } from "../services/order.service.js";
import { parsePaginationQuery } from "../utils/pagination.js";

export class ClientOrderController {
  constructor(private readonly orderService = new OrderService()) {}

  submitOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const clientId = actor.clientId || actor.subjectId;

      const result = await this.orderService.submitOrder({
        tenantId: actor.tenantId,
        clientId,
        ...req.body,
        actor: {
          id: actor.subjectId,
          email: actor.email,
          ip: req.ip,
          requestId: actor.requestId,
          type: "client",
        },
      });

      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  listOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const clientId = actor.clientId || actor.subjectId;
      const pagination = parsePaginationQuery(req.query as any);

      const result = await this.orderService.listOrders({
        tenantId: actor.tenantId,
        pagination,
        isClient: true,
        clientId,
        filter: {
          status: req.query.status as string | undefined,
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
      const clientId = actor.clientId || actor.subjectId;

      const result = await this.orderService.getOrderById({
        tenantId: actor.tenantId,
        orderId: req.params.id as string,
        isClient: true,
        clientId,
      });

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  acceptQuotation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const clientId = actor.clientId || actor.subjectId;

      const result = await this.orderService.clientAcceptQuotation({
        tenantId: actor.tenantId,
        clientId,
        orderId: req.params.id as string,
        revisionNo: req.body?.revisionNo,
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

  declineQuotation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const clientId = actor.clientId || actor.subjectId;

      const result = await this.orderService.clientDeclineQuotation({
        tenantId: actor.tenantId,
        clientId,
        orderId: req.params.id as string,
        revisionNo: req.body?.revisionNo,
        reason: req.body?.reason,
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

  createPaymentOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const clientId = actor.clientId || actor.subjectId;

      const milestoneIndex =
        req.params.milestoneIndex !== undefined
          ? Number(req.params.milestoneIndex)
          : req.body.milestoneIndex !== undefined
          ? Number(req.body.milestoneIndex)
          : undefined;

      const result = await this.orderService.createPaymentOrder({
        tenantId: actor.tenantId,
        orderId: req.params.id as string,
        milestoneIndex,
        notes: req.body.notes,
        isClient: true,
        clientId,
      });

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };
}
