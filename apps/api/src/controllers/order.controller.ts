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

  assignSupervisors = async (req: Request, res: Response): Promise<void> => {
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
  };

  startProduction = async (req: Request, res: Response): Promise<void> => {
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

    res.json({ data: result });
  };

  holdOrder = async (req: Request, res: Response): Promise<void> => {
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
  };

  resumeOrder = async (req: Request, res: Response): Promise<void> => {
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
  };

  cancelOrder = async (req: Request, res: Response): Promise<void> => {
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
  };

  markReadyForDelivery = async (req: Request, res: Response): Promise<void> => {
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
  };

  createPaymentOrder = async (req: Request, res: Response): Promise<void> => {
    const actor = req.actor!;

    const result = await this.orderService.createPaymentOrder({
      tenantId: actor.tenantId,
      orderId: req.params.id as string,
      milestoneIndex: req.body.milestoneIndex !== undefined ? Number(req.body.milestoneIndex) : undefined,
      notes: req.body.notes,
      isClient: false,
    });

    res.json({ data: result });
  };

  recordManualReceipt = async (req: Request, res: Response): Promise<void> => {
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
  };

  reverseReceipt = async (req: Request, res: Response): Promise<void> => {
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
  };

  recordDelivery = async (req: Request, res: Response): Promise<void> => {
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
  };
}
