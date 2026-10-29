import { Request, Response } from "express";
import { SupplierOrderService } from "../services/supplier-order.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { actorFrom } from "../utils/actor.js";
import { buildPaginatedEnvelope } from "../utils/pagination.js";

export class SupplierOrderController {
  constructor(private readonly service: SupplierOrderService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const page = await this.service.list(actorFrom(req), {
      ...req.query,
      supplierId: req.query.supplierId as string,
      status: req.query.status as any,
    });
    res.json(
      buildPaginatedEnvelope(
        page.items,
        { page: page.page, limit: page.limit, total: page.total },
        req.requestId
      )
    );
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const order = await this.service.getById(actorFrom(req), req.params.id!);
    res.json({
      data: order,
      requestId: req.requestId,
    });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const order = await this.service.create(actorFrom(req), req.body);
    res.status(201).json({
      data: order,
      requestId: req.requestId,
    });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const order = await this.service.update(actorFrom(req), req.params.id!, req.body);
    res.json({
      data: order,
      requestId: req.requestId,
    });
  });

  receive = asyncHandler(async (req: Request, res: Response) => {
    const order = await this.service.receive(actorFrom(req), req.params.id!, req.body);
    res.json({
      data: order,
      requestId: req.requestId,
    });
  });
}

