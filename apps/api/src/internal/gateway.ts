import { Router, Request, Response } from "express";
import { serviceAuthMiddleware } from "../middleware/serviceAuth.js";
import { QuotationModel } from "../modules/quotations/model.js";
import { AlertService } from "../modules/alerts/service.js";
import { PaymentService } from "../modules/payments/service.js";
import { QuotationStatus, ReminderStatus } from "@loompilot/shared";
import { logger } from "../config/logger.js";

export const internalGatewayRouter = Router();

// Protect ALL /internal routes with strict constant-time service token auth
internalGatewayRouter.use(serviceAuthMiddleware);

/**
 * Ingest draft quotation proposals from QuotationAgent
 */
internalGatewayRouter.post("/quotations/drafts", async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const count = await QuotationModel.countDocuments({ tenantId: data.tenantId });
    const quotationNumber = `QT-${String(count + 1).padStart(5, "0")}`;

    const quotation = await QuotationModel.create({
      ...data,
      quotationNumber: data.quotationNumber || quotationNumber,
      status: QuotationStatus.DRAFT,
    });

    logger.info(
      { quotationId: quotation._id, tenantId: data.tenantId, requestId: req.requestId },
      "Ingested draft quotation from agent gateway"
    );

    res.status(201).json({ data: quotation, requestId: req.requestId });
  } catch (err: any) {
    res.status(400).json({ error: "IngestionFailed", message: err.message, requestId: req.requestId });
  }
});

/**
 * Ingest production alerts from MonitoringAgent
 */
internalGatewayRouter.post("/alerts", async (req: Request, res: Response) => {
  try {
    const alert = await AlertService.createAlert(req.body);
    logger.info(
      { alertId: alert._id, orderId: req.body.orderId, requestId: req.requestId },
      "Ingested production alert from agent gateway"
    );
    res.status(201).json({ data: alert, requestId: req.requestId });
  } catch (err: any) {
    res.status(400).json({ error: "IngestionFailed", message: err.message, requestId: req.requestId });
  }
});

/**
 * Ingest recommendations from MonitoringAgent
 */
internalGatewayRouter.post("/recommendations", async (req: Request, res: Response) => {
  try {
    const rec = await AlertService.createRecommendation(req.body);
    logger.info(
      { recId: rec._id, alertId: req.body.alertId, requestId: req.requestId },
      "Ingested recommendation from agent gateway"
    );
    res.status(201).json({ data: rec, requestId: req.requestId });
  } catch (err: any) {
    res.status(400).json({ error: "IngestionFailed", message: err.message, requestId: req.requestId });
  }
});

/**
 * Ingest monitoring snapshots (historical telemetry)
 */
internalGatewayRouter.post("/monitoring-snapshots", async (req: Request, res: Response) => {
  res.status(201).json({
    data: { status: "recorded", timestamp: new Date().toISOString() },
    requestId: req.requestId,
  });
});

/**
 * Ingest post-delivery payment follow-ups from PaymentAgent
 */
internalGatewayRouter.post("/payment-followups", async (req: Request, res: Response) => {
  try {
    const followup = await PaymentService.createFollowup(req.body);
    logger.info(
      { paymentId: followup._id, deliveryId: req.body.deliveryId, requestId: req.requestId },
      "Ingested payment follow-up from agent gateway"
    );
    res.status(201).json({ data: followup, requestId: req.requestId });
  } catch (err: any) {
    res.status(400).json({ error: "IngestionFailed", message: err.message, requestId: req.requestId });
  }
});

/**
 * Ingest drafted reminders from PaymentAgent
 */
internalGatewayRouter.post("/payment-reminder-drafts", async (req: Request, res: Response) => {
  try {
    const { tenantId, paymentId, ...draft } = req.body;
    const payment = await PaymentService.addReminderDraft(tenantId, paymentId, {
      ...draft,
      status: ReminderStatus.DRAFT,
    });
    logger.info(
      { paymentId, reminderNumber: draft.reminderNumber, requestId: req.requestId },
      "Ingested payment reminder draft from agent gateway"
    );
    res.status(201).json({ data: payment, requestId: req.requestId });
  } catch (err: any) {
    res.status(400).json({ error: "IngestionFailed", message: err.message, requestId: req.requestId });
  }
});
