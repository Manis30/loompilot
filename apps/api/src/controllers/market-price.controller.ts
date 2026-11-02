import { Request, Response, NextFunction } from "express";
import { MarketPriceService } from "../services/market-price.service.js";
import { IAgentsClient } from "../interfaces/agents-client.interface.js";
import { AppError } from "../errors/app-error.js";
import { ErrorCode } from "@loompilot/shared";

export class MarketPriceController {
  private service: MarketPriceService;

  constructor(agentsClient?: IAgentsClient) {
    this.service = new MarketPriceService(undefined, undefined, agentsClient);
  }

  getMarketPrices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const tenantId = req.tenantId || actor.tenantId;
      const prices = await this.service.getMarketPrices(tenantId);
      res.status(200).json({ success: true, data: prices });
    } catch (err) {
      next(err);
    }
  };

  getSurgeAlerts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const tenantId = req.tenantId || actor.tenantId;
      const alerts = await this.service.getSurgeAlerts(tenantId);
      res.status(200).json({ success: true, data: alerts });
    } catch (err) {
      next(err);
    }
  };

  triggerRequote = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const tenantId = req.tenantId || actor.tenantId;
      const auditActor = {
        id: actor.subjectId,
        email: actor.email,
        ip: req.ip,
        requestId: (req as any).id,
      };
      const { orderId, notes, surgeRatePaise } = req.body;

      if (!orderId) {
        throw new AppError(ErrorCode.VALIDATION_FAILED, "orderId is required", 400);
      }

      const updated = await this.service.triggerRequote(tenantId, auditActor, {
        orderId,
        notes,
        surgeRatePaise,
      });

      res.status(200).json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  };
}
