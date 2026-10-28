import { Request, Response } from "express";
import { DeliveryService } from "../services/delivery.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { actorFrom } from "../utils/actor.js";
import { toDeliveryResponse } from "../mappers/delivery.mapper.js";

export class DeliveryController {
  constructor(private readonly service: DeliveryService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const page = await this.service.list(actorFrom(req), req.query);
    res.json({
      data: page.items.map(toDeliveryResponse),
      total: page.total,
      page: page.page,
      limit: page.limit,
      requestId: req.requestId,
    });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const delivery = await this.service.getById(actorFrom(req), req.params.id!);
    res.json({
      data: toDeliveryResponse(delivery),
      requestId: req.requestId,
    });
  });

  recordDelivery = asyncHandler(async (req: Request, res: Response) => {
    const delivery = await this.service.recordDelivery(actorFrom(req), req.body);
    res.status(201).json({
      data: toDeliveryResponse(delivery),
      requestId: req.requestId,
    });
  });
}

