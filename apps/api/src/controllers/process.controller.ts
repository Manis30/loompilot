import { Request, Response } from "express";
import { ProcessService } from "../services/process.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { actorFrom } from "../utils/actor.js";
import { toProcessResponse } from "../mappers/process.mapper.js";

export class ProcessController {
  constructor(private readonly service: ProcessService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const page = await this.service.list(actorFrom(req), req.query);
    res.json({
      data: page.items.map(toProcessResponse),
      total: page.total,
      page: page.page,
      limit: page.limit,
      requestId: req.requestId,
    });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const processItem = await this.service.getById(actorFrom(req), req.params.id!);
    res.json({
      data: toProcessResponse(processItem),
      requestId: req.requestId,
    });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const processItem = await this.service.create(actorFrom(req), req.body);
    res.status(201).json({
      data: toProcessResponse(processItem),
      requestId: req.requestId,
    });
  });
}

