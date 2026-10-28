import { Request, Response } from "express";
import { ReportService } from "../services/report.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { actorFrom } from "../utils/actor.js";

export class ReportController {
  constructor(private readonly service: ReportService) {}

  getMarginReport = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const actor = actorFrom(req);
    const data = await this.service.getMarginReport(actor);
    res.json({ data, requestId: req.requestId });
  });

  getOnTimeReport = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const actor = actorFrom(req);
    const data = await this.service.getOnTimeReport(actor);
    res.json({ data, requestId: req.requestId });
  });

  getCollectionsReport = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const actor = actorFrom(req);
    const data = await this.service.getCollectionsReport(actor);
    res.json({ data, requestId: req.requestId });
  });
}
