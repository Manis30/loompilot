import { Request, Response } from "express";
import { QuotationService } from "../services/quotation.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { actorFrom } from "../utils/actor.js";
import { toQuotationResponse } from "../mappers/quotation.mapper.js";
import { toOrderResponse } from "../mappers/order.mapper.js";

export class QuotationController {
  constructor(private readonly service: QuotationService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const actor = actorFrom(req);
    const page = await this.service.list(actor, req.query);
    res.json({
      data: page.items.map((q) => toQuotationResponse(q, actor.role)),
      total: page.total,
      page: page.page,
      limit: page.limit,
      requestId: req.requestId,
    });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const actor = actorFrom(req);
    const quote = await this.service.getById(actor, req.params.id!);
    res.json({
      data: toQuotationResponse(quote, actor.role),
      requestId: req.requestId,
    });
  });

  approve = asyncHandler(async (req: Request, res: Response) => {
    const actor = actorFrom(req);
    const quote = await this.service.approve(actor, req.params.id!);
    res.json({
      data: toQuotationResponse(quote, actor.role),
      requestId: req.requestId,
    });
  });

  send = asyncHandler(async (req: Request, res: Response) => {
    const actor = actorFrom(req);
    const { quotation } = await this.service.send(actor, req.params.id!);
    res.json({
      data: toQuotationResponse(quotation, actor.role),
      message: "Quotation marked as sent and PDF generated",
      requestId: req.requestId,
    });
  });

  downloadPdf = asyncHandler(async (req: Request, res: Response) => {
    const actor = actorFrom(req);
    const { quotation, pdfBuffer } = await this.service.send(actor, req.params.id!);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${quotation.quotationNumber}.pdf"`
    );
    res.send(pdfBuffer);
  });

  confirm = asyncHandler(async (req: Request, res: Response) => {
    const actor = actorFrom(req);
    const order = await this.service.confirmOrder(actor, req.params.id!);
    res.status(201).json({
      data: toOrderResponse(order),
      message: "Quotation confirmed. Stock reserved and production order plan initialized.",
      requestId: req.requestId,
    });
  });
}

