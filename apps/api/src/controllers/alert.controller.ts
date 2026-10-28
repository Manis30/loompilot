import { Request, Response } from "express";
import { AlertService } from "../services/alert.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { actorFrom } from "../utils/actor.js";
import {
  toAlertResponse,
  toRecommendationResponse,
} from "../mappers/alert.mapper.js";

export class AlertController {
  constructor(private readonly service: AlertService) {}

  listAlerts = asyncHandler(async (req: Request, res: Response) => {
    const page = await this.service.listAlerts(actorFrom(req), req.query);
    res.json({
      data: page.items.map(toAlertResponse),
      total: page.total,
      page: page.page,
      limit: page.limit,
      requestId: req.requestId,
    });
  });

  acknowledgeAlert = asyncHandler(async (req: Request, res: Response) => {
    const alert = await this.service.acknowledgeAlert(actorFrom(req), req.params.id!);
    res.json({
      data: toAlertResponse(alert),
      requestId: req.requestId,
    });
  });

  listRecommendations = asyncHandler(async (req: Request, res: Response) => {
    const page = await this.service.listRecommendations(actorFrom(req), req.query);
    res.json({
      data: page.items.map(toRecommendationResponse),
      total: page.total,
      page: page.page,
      limit: page.limit,
      requestId: req.requestId,
    });
  });

  decideRecommendation = asyncHandler(async (req: Request, res: Response) => {
    const rec = await this.service.decideRecommendation(
      actorFrom(req),
      req.params.id!,
      req.body
    );
    res.json({
      data: toRecommendationResponse(rec),
      requestId: req.requestId,
    });
  });
}

