import { Request, Response } from "express";
import { AlertService } from "./service.js";

export class AlertController {
  static async listAlerts(req: Request, res: Response): Promise<void> {
    const alerts = await AlertService.listAlerts(req.user!.tenantId);
    res.json({ data: alerts, requestId: req.requestId });
  }

  static async acknowledgeAlert(req: Request, res: Response): Promise<void> {
    const alert = await AlertService.acknowledgeAlert(req.user!.tenantId, req.params.id!);
    if (!alert) {
      res.status(404).json({ error: "NotFound", message: "Alert not found", requestId: req.requestId });
      return;
    }
    res.json({ data: alert, requestId: req.requestId });
  }

  static async listRecommendations(req: Request, res: Response): Promise<void> {
    const recs = await AlertService.listRecommendations(req.user!.tenantId);
    res.json({ data: recs, requestId: req.requestId });
  }

  static async decideRecommendation(req: Request, res: Response): Promise<void> {
    try {
      const rec = await AlertService.decideRecommendation(
        req.user!.tenantId,
        req.params.id!,
        req.user!.userId,
        req.body.action,
        req.body.selectedOptionId,
        req.body.rejectionReason
      );
      res.json({ data: rec, requestId: req.requestId });
    } catch (err: any) {
      res.status(400).json({ error: "BadRequest", message: err.message, requestId: req.requestId });
    }
  }
}

