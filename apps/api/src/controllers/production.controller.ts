import { Request, Response, NextFunction } from "express";
import { OrderService } from "../services/order.service.js";

export class ProductionController {
  constructor(private readonly orderService = new OrderService()) {}

  getProductionBoard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const board = await this.orderService.getProductionBoard(actor.tenantId, {
        id: actor.subjectId,
        role: actor.role,
      });
      res.json({ data: board });
    } catch (err) {
      next(err);
    }
  };
}

