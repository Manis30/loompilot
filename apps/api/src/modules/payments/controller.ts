import { Request, Response } from "express";
import { PaymentService } from "./service.js";

export class PaymentController {
  static async list(req: Request, res: Response): Promise<void> {
    const payments = await PaymentService.list(req.user!.tenantId);
    res.json({ data: payments, requestId: req.requestId });
  }

  static async getById(req: Request, res: Response): Promise<void> {
    const payment = await PaymentService.getById(req.user!.tenantId, req.params.id!);
    if (!payment) {
      res.status(404).json({ error: "NotFound", message: "Payment not found", requestId: req.requestId });
      return;
    }
    res.json({ data: payment, requestId: req.requestId });
  }

  static async approveReminder(req: Request, res: Response): Promise<void> {
    try {
      const payment = await PaymentService.approveReminder(
        req.user!.tenantId,
        req.params.id!,
        req.params.reminderId!,
        req.user!.userId,
        req.body.action,
        req.body.rejectionReason
      );
      res.json({ data: payment, requestId: req.requestId });
    } catch (err: any) {
      res.status(400).json({ error: "BadRequest", message: err.message, requestId: req.requestId });
    }
  }

  static async recordReceipt(req: Request, res: Response): Promise<void> {
    try {
      const payment = await PaymentService.recordReceipt(
        req.user!.tenantId,
        req.params.id!,
        req.body.amountPaise
      );
      res.json({ data: payment, requestId: req.requestId });
    } catch (err: any) {
      res.status(400).json({ error: "BadRequest", message: err.message, requestId: req.requestId });
    }
  }
}
