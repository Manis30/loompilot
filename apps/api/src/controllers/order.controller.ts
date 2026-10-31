import { Request, Response } from "express";
import { OrderService } from "../services/order.service.js";
import { parsePaginationQuery } from "../utils/pagination.js";

export class OrderController {
  constructor(private readonly orderService = new OrderService()) {}

  listOrders = async (req: Request, res: Response): Promise<void> => {
    const actor = req.actor!;
    const pagination = parsePaginationQuery(req.query as any);

    const result = await this.orderService.listOrders({
      tenantId: actor.tenantId,
      pagination,
      isClient: false,
      filter: {
        status: req.query.status as string | undefined,
        clientId: req.query.clientId as string | undefined,
        search: req.query.search as string | undefined,
      },
    });

    res.json(result);
  };

  getOrderById = async (req: Request, res: Response): Promise<void> => {
    const actor = req.actor!;

    const result = await this.orderService.getOrderById({
      tenantId: actor.tenantId,
      orderId: req.params.id as string,
      isClient: false,
    });

    res.json({ data: result });
  };

  createOrder = async (req: Request, res: Response): Promise<void> => {
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
  };

  decideOrder = async (req: Request, res: Response): Promise<void> => {
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
  };

  approveQuotation = async (req: Request, res: Response): Promise<void> => {
    const actor = req.actor!;

    const result = await this.orderService.approveQuotation({
      tenantId: actor.tenantId,
      orderId: req.params.id as string,
      notes: req.body.notes,
      actor: {
        id: actor.subjectId,
        email: actor.email,
        ip: req.ip,
        requestId: actor.requestId,
      },
    });

    res.json({ data: result });
  };

  sendQuotation = async (req: Request, res: Response): Promise<void> => {
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
  };
}
