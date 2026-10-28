import { Request, Response } from "express";
import { EnquiryService } from "./service.js";

export class EnquiryController {
  static async list(req: Request, res: Response): Promise<void> {
    const enquiries = await EnquiryService.list(req.user!.tenantId);
    res.json({ data: enquiries, requestId: req.requestId });
  }

  static async getById(req: Request, res: Response): Promise<void> {
    const enquiry = await EnquiryService.getById(req.user!.tenantId, req.params.id!);
    if (!enquiry) {
      res.status(404).json({ error: "NotFound", message: "Enquiry not found", requestId: req.requestId });
      return;
    }
    res.json({ data: enquiry, requestId: req.requestId });
  }

  static async create(req: Request, res: Response): Promise<void> {
    const enquiry = await EnquiryService.create({
      ...req.body,
      tenantId: req.user!.tenantId,
    });
    res.status(201).json({ data: enquiry, requestId: req.requestId });
  }
}
