import { Request, Response } from "express";
import { DeliveryService } from "./service.js";

export class DeliveryController {
  static async list(req: Request, res: Response): Promise<void> {
    const deliveries = await DeliveryService.list(req.user!.tenantId);
    res.json({ data: deliveries, requestId: req.requestId });
  }

  static async getById(req: Request, res: Response): Promise<void> {
    const delivery = await DeliveryService.getById(req.user!.tenantId, req.params.id!);
    if (!delivery) {
      res.status(404).json({ error: "NotFound", message: "Delivery not found", requestId: req.requestId });
      return;
    }
    res.json({ data: delivery, requestId: req.requestId });
  }

  static async recordDelivery(req: Request, res: Response): Promise<void> {
    try {
      const delivery = await DeliveryService.recordDelivery({
        ...req.body,
        tenantId: req.user!.tenantId,
      });
      res.status(201).json({ data: delivery, requestId: req.requestId });
    } catch (err: any) {
      res.status(400).json({ error: "BadRequest", message: err.message, requestId: req.requestId });
    }
  }
}

