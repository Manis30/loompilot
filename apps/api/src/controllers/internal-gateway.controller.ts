import { Request, Response } from "express";
import { OrderService } from "../services/order.service.js";

export class InternalGatewayController {
  constructor(private readonly orderService = new OrderService()) {}

  ingestFeasibilityReport = async (req: Request, res: Response): Promise<void> => {
    const report = req.body;
    const result = await this.orderService.ingestFeasibilityReport(report, {
      id: "agent_gateway",
      type: "agent",
      requestId: (req as any).id,
    });

    res.status(200).json({ success: true, data: result });
  };

  ingestQuotationDraft = async (req: Request, res: Response): Promise<void> => {
    const draft = req.body;
    const result = await this.orderService.ingestQuotationDraft(draft, {
      id: "agent_gateway",
      type: "agent",
      requestId: (req as any).id,
    });

    res.status(200).json({ success: true, data: result });
  };

  ingestQuotationRevision = async (req: Request, res: Response): Promise<void> => {
    const revision = req.body;
    const result = await this.orderService.ingestQuotationRevision(revision, {
      id: "agent_gateway",
      type: "agent",
      requestId: (req as any).id,
    });

    res.status(200).json({ success: true, data: result });
  };
}
