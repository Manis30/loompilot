import { Request, Response, NextFunction } from "express";
import { OrderService } from "../services/order.service.js";

export class WebhookController {
  constructor(private readonly orderService = new OrderService()) {}

  handleRazorpayWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const signature = req.headers["x-razorpay-signature"] as string | undefined;
      const rawBody = (req as any).rawBody || req.body;

      const result = await this.orderService.processRazorpayWebhook(rawBody, signature);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}
