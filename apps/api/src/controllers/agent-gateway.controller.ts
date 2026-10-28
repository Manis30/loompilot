import { Request, Response } from "express";
import { AgentGatewayService } from "../services/agent-gateway.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { UserRole } from "@loompilot/shared";
import { logger } from "../config/logger.js";
import { toQuotationResponse } from "../mappers/quotation.mapper.js";
import { toAlertResponse, toRecommendationResponse } from "../mappers/alert.mapper.js";
import { toPaymentResponse } from "../mappers/payment.mapper.js";

export class AgentGatewayController {
  constructor(private readonly service: AgentGatewayService) {}

  private getGatewayActor(req: Request) {
    return {
      tenantId: req.body.tenantId,
      userId: "agent_gateway",
      role: UserRole.OWNER,
      email: "agent@loompilot.internal",
    };
  }

  ingestQuotationDraft = asyncHandler(async (req: Request, res: Response) => {
    const actor = this.getGatewayActor(req);
    const quotation = await this.service.ingestQuotationDraft(actor, req.body);
    logger.info(
      { quotationId: quotation.id, tenantId: req.body.tenantId, requestId: req.requestId },
      "Ingested draft quotation from agent gateway"
    );
    res.status(201).json({ data: toQuotationResponse(quotation), requestId: req.requestId });
  });

  ingestAlert = asyncHandler(async (req: Request, res: Response) => {
    const actor = this.getGatewayActor(req);
    const alert = await this.service.ingestAlert(actor, req.body);
    logger.info(
      { alertId: alert.id, orderId: req.body.orderId, requestId: req.requestId },
      "Ingested production alert from agent gateway"
    );
    res.status(201).json({ data: toAlertResponse(alert), requestId: req.requestId });
  });

  ingestRecommendation = asyncHandler(async (req: Request, res: Response) => {
    const actor = this.getGatewayActor(req);
    const rec = await this.service.ingestRecommendation(actor, req.body);
    logger.info(
      { recId: rec.id, alertId: req.body.alertId, requestId: req.requestId },
      "Ingested recommendation from agent gateway"
    );
    res.status(201).json({ data: toRecommendationResponse(rec), requestId: req.requestId });
  });

  recordMonitoringSnapshot = asyncHandler(async (req: Request, res: Response) => {
    const actor = this.getGatewayActor(req);
    const data = await this.service.recordMonitoringSnapshot(actor, req.body);
    res.status(201).json({ data, requestId: req.requestId });
  });

  ingestPaymentFollowup = asyncHandler(async (req: Request, res: Response) => {
    const actor = this.getGatewayActor(req);
    const followup = await this.service.ingestPaymentFollowup(actor, req.body);
    logger.info(
      { paymentId: followup.id, deliveryId: req.body.deliveryId, requestId: req.requestId },
      "Ingested payment follow-up from agent gateway"
    );
    res.status(201).json({ data: toPaymentResponse(followup), requestId: req.requestId });
  });

  ingestPaymentReminderDraft = asyncHandler(async (req: Request, res: Response) => {
    const actor = this.getGatewayActor(req);
    const { paymentId, ...draft } = req.body;
    const payment = await this.service.ingestPaymentReminderDraft(actor, paymentId, draft);
    logger.info(
      { paymentId, reminderNumber: draft.reminderNumber, requestId: req.requestId },
      "Ingested payment reminder draft from agent gateway"
    );
    res.status(201).json({ data: toPaymentResponse(payment), requestId: req.requestId });
  });
}
