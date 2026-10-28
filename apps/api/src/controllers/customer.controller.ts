import { Request, Response } from "express";
import { CustomerService } from "../services/customer.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { actorFrom } from "../utils/actor.js";
import { toCustomerResponse } from "../mappers/customer.mapper.js";

export class CustomerController {
  constructor(private readonly service: CustomerService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const page = await this.service.list(actorFrom(req), req.query);
    res.json({
      data: page.items.map(toCustomerResponse),
      total: page.total,
      page: page.page,
      limit: page.limit,
      requestId: req.requestId,
    });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const customer = await this.service.getById(actorFrom(req), req.params.id!);
    res.json({
      data: toCustomerResponse(customer),
      requestId: req.requestId,
    });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const customer = await this.service.create(actorFrom(req), req.body);
    res.status(201).json({
      data: toCustomerResponse(customer),
      requestId: req.requestId,
    });
  });
}
