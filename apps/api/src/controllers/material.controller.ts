import { Request, Response } from "express";
import { MaterialService } from "../services/material.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { actorFrom } from "../utils/actor.js";
import {
  toMaterialResponse,
  toStockMovementResponse,
  toPriceHistoryResponse,
} from "../mappers/material.mapper.js";

export class MaterialController {
  constructor(private readonly service: MaterialService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const actor = actorFrom(req);
    const page = await this.service.list(actor, req.query);
    res.json({
      data: page.items.map((m) => toMaterialResponse(m, actor.role)),
      total: page.total,
      page: page.page,
      limit: page.limit,
      requestId: req.requestId,
    });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const actor = actorFrom(req);
    const material = await this.service.getById(actor, req.params.id!);
    res.json({
      data: toMaterialResponse(material, actor.role),
      requestId: req.requestId,
    });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const actor = actorFrom(req);
    const material = await this.service.create(actor, req.body);
    res.status(201).json({
      data: toMaterialResponse(material, actor.role),
      requestId: req.requestId,
    });
  });

  recordMovement = asyncHandler(async (req: Request, res: Response) => {
    const actor = actorFrom(req);
    const movement = await this.service.recordMovement(actor, req.params.id!, req.body);
    res.status(201).json({
      data: toStockMovementResponse(movement),
      requestId: req.requestId,
    });
  });

  getMovements = asyncHandler(async (req: Request, res: Response) => {
    const actor = actorFrom(req);
    const movements = await this.service.getMovements(actor, req.params.id!);
    res.json({
      data: movements.map(toStockMovementResponse),
      requestId: req.requestId,
    });
  });

  getPriceHistory = asyncHandler(async (req: Request, res: Response) => {
    const actor = actorFrom(req);
    const history = await this.service.getPriceHistory(actor, req.params.id!);
    res.json({
      data: history.map(toPriceHistoryResponse),
      requestId: req.requestId,
    });
  });
}

