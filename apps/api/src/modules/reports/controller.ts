import { Request, Response } from "express";
import { ReportsService } from "./service.js";

export class ReportsController {
  static async getMarginReport(req: Request, res: Response): Promise<void> {
    const report = await ReportsService.getMarginReport(req.user!.tenantId);
    res.json({ data: report, requestId: req.requestId });
  }

  static async getOnTimeReport(req: Request, res: Response): Promise<void> {
    const report = await ReportsService.getOnTimeReport(req.user!.tenantId);
    res.json({ data: report, requestId: req.requestId });
  }

  static async getCollectionsReport(req: Request, res: Response): Promise<void> {
    const report = await ReportsService.getCollectionsReport(req.user!.tenantId);
    res.json({ data: report, requestId: req.requestId });
  }
}

