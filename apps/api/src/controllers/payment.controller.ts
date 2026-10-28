import { Request, Response } from "express";
import { PaymentService } from "../services/payment.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { actorFrom } from "../utils/actor.js";
import { toPaymentResponse } from "../mappers/payment.mapper.js";

export class PaymentController {
  constructor(private readonly service: PaymentService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const page = await this.service.list(actorFrom(req), req.query);
    res.json({
      data: page.items.map(toPaymentResponse),
      total: page.total,
      page: page.page,
      limit: page.limit,
      requestId: req.requestId,
    });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const payment = await this.service.getById(actorFrom(req), req.params.id!);
    res.json({
      data: toPaymentResponse(payment),
      requestId: req.requestId,
    });
  });

  approveReminder = asyncHandler(async (req: Request, res: Response) => {
    const payment = await this.service.approveReminder(
      actorFrom(req),
      req.params.id!,
      req.params.reminderId!,
      req.body
    );
    res.json({
      data: toPaymentResponse(payment),
      requestId: req.requestId,
    });
  });

  recordReceipt = asyncHandler(async (req: Request, res: Response) => {
    const payment = await this.service.recordReceipt(
      actorFrom(req),
      req.params.id!,
      req.body.amountPaise
    );
    res.json({
      data: toPaymentResponse(payment),
      requestId: req.requestId,
    });
  });
}
