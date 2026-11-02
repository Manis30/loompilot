import { Request, Response, NextFunction } from "express";
import { OrderService } from "../services/order.service.js";

export class InternalGatewayController {
  constructor(private readonly orderService = new OrderService()) {}

  ingestFeasibilityReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const report = req.body;
      const result = await this.orderService.ingestFeasibilityReport(report, {
        id: "agent_gateway",
        type: "agent",
        requestId: (req as any).id,
      });

      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  ingestQuotationDraft = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const draft = req.body;
      const result = await this.orderService.ingestQuotationDraft(draft, {
        id: "agent_gateway",
        type: "agent",
        requestId: (req as any).id,
      });

      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  ingestQuotationRevision = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const revision = req.body;
      const result = await this.orderService.ingestQuotationRevision(revision, {
        id: "agent_gateway",
        type: "agent",
        requestId: (req as any).id,
      });

      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  ingestMonitoringSnapshot = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const snapshot = req.body;
      const result = await this.orderService.ingestMonitoringSnapshot(snapshot, {
        id: "agent_gateway",
        type: "agent",
        requestId: (req as any).id,
      });

      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };
}
