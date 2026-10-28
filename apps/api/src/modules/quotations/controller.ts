import { Request, Response } from "express";
import { QuotationService } from "./service.js";

export class QuotationController {
  static async list(req: Request, res: Response): Promise<void> {
    const quotations = await QuotationService.list(req.user!.tenantId);
    res.json({ data: quotations, requestId: req.requestId });
  }

  static async getById(req: Request, res: Response): Promise<void> {
    const quotation = await QuotationService.getById(req.user!.tenantId, req.params.id!);
    if (!quotation) {
      res.status(404).json({ error: "NotFound", message: "Quotation not found", requestId: req.requestId });
      return;
    }
    res.json({ data: quotation, requestId: req.requestId });
  }

  static async approve(req: Request, res: Response): Promise<void> {
    try {
      const quotation = await QuotationService.approve(
        req.user!.tenantId,
        req.params.id!,
        req.user!.userId
      );
      res.json({ data: quotation, requestId: req.requestId });
    } catch (err: any) {
      res.status(400).json({ error: "BadRequest", message: err.message, requestId: req.requestId });
    }
  }

  static async send(req: Request, res: Response): Promise<void> {
    try {
      const { quotation } = await QuotationService.send(req.user!.tenantId, req.params.id!);
      res.json({ data: quotation, message: "Quotation marked as sent and PDF generated", requestId: req.requestId });
    } catch (err: any) {
      res.status(400).json({ error: "BadRequest", message: err.message, requestId: req.requestId });
    }
  }

  static async downloadPdf(req: Request, res: Response): Promise<void> {
    try {
      const { quotation, pdfBuffer } = await QuotationService.send(req.user!.tenantId, req.params.id!);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${quotation.quotationNumber}.pdf"`
      );
      res.send(pdfBuffer);
    } catch (err: any) {
      res.status(400).json({ error: "BadRequest", message: err.message, requestId: req.requestId });
    }
  }

  static async confirm(req: Request, res: Response): Promise<void> {
    try {
      const order = await QuotationService.confirmOrder(req.user!.tenantId, req.params.id!);
      res.status(201).json({
        data: order,
        message: "Quotation confirmed. Stock reserved and production order plan initialized.",
        requestId: req.requestId,
      });
    } catch (err: any) {
      res.status(400).json({ error: "ConfirmationFailed", message: err.message, requestId: req.requestId });
    }
  }
}

