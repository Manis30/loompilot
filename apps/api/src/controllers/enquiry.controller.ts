import { Request, Response } from "express";
import { EnquiryService } from "../services/enquiry.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { actorFrom } from "../utils/actor.js";
import { toEnquiryResponse } from "../mappers/enquiry.mapper.js";

export class EnquiryController {
  constructor(private readonly service: EnquiryService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const page = await this.service.list(actorFrom(req), req.query);
    res.json({
      data: page.items.map(toEnquiryResponse),
      total: page.total,
      page: page.page,
      limit: page.limit,
      requestId: req.requestId,
    });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const enquiry = await this.service.getById(actorFrom(req), req.params.id!);
    res.json({
      data: toEnquiryResponse(enquiry),
      requestId: req.requestId,
    });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const enquiry = await this.service.create(actorFrom(req), req.body);
    res.status(201).json({
      data: toEnquiryResponse(enquiry),
      requestId: req.requestId,
    });
  });
}
