import { Request, Response } from "express";
import { OrderService } from "./service.js";

export class OrderController {
  static async list(req: Request, res: Response): Promise<void> {
    const orders = await OrderService.list(req.user!.tenantId);
    res.json({ data: orders, requestId: req.requestId });
  }

  static async getById(req: Request, res: Response): Promise<void> {
    const order = await OrderService.getById(req.user!.tenantId, req.params.id!);
    if (!order) {
      res.status(404).json({ error: "NotFound", message: "Order not found", requestId: req.requestId });
      return;
    }
    res.json({ data: order, requestId: req.requestId });
  }

  static async getVariance(req: Request, res: Response): Promise<void> {
    try {
      const variance = await OrderService.getVariance(req.user!.tenantId, req.params.id!);
      res.json({ data: variance, requestId: req.requestId });
    } catch (err: any) {
      res.status(404).json({ error: "NotFound", message: err.message, requestId: req.requestId });
    }
  }
}
