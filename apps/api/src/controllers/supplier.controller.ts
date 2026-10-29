import { Request, Response } from "express";
import { SupplierService } from "../services/supplier.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { actorFrom } from "../utils/actor.js";
import { toSupplierResponse } from "../mappers/supplier.mapper.js";

export class SupplierController {
  constructor(private readonly service: SupplierService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const page = await this.service.list(actorFrom(req), req.query);
    res.json({
      data: page.items.map(toSupplierResponse),
      total: page.total,
      page: page.page,
      limit: page.limit,
      requestId: req.requestId,
    });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const supplier = await this.service.getById(actorFrom(req), req.params.id!);
    res.json({
      data: toSupplierResponse(supplier),
      requestId: req.requestId,
    });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const supplier = await this.service.create(actorFrom(req), req.body);
    res.status(201).json({
      data: toSupplierResponse(supplier),
      requestId: req.requestId,
    });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const supplier = await this.service.update(
      actorFrom(req),
      req.params.id as string,
      req.body
    );
    res.json({
      data: toSupplierResponse(supplier),
      requestId: req.requestId,
    });
  });
}

