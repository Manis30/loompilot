import { Request, Response } from "express";
import { OrderService } from "../services/order.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { actorFrom } from "../utils/actor.js";
import { toOrderResponse, toVarianceResponse } from "../mappers/order.mapper.js";

export class OrderController {
  constructor(private readonly service: OrderService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const page = await this.service.list(actorFrom(req), req.query);
    res.json({
      data: page.items.map(toOrderResponse),
      total: page.total,
      page: page.page,
      limit: page.limit,
      requestId: req.requestId,
    });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const order = await this.service.getById(actorFrom(req), req.params.id!);
    res.json({
      data: toOrderResponse(order),
      requestId: req.requestId,
    });
  });

  getVariance = asyncHandler(async (req: Request, res: Response) => {
    const variance = await this.service.getVariance(actorFrom(req), req.params.id!);
    res.json({
      data: toVarianceResponse(variance),
      requestId: req.requestId,
    });
  });
}

