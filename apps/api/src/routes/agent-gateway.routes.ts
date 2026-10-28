import { Router } from "express";
import { AgentGatewayController } from "../controllers/agent-gateway.controller.js";
import { serviceAuthMiddleware } from "../middleware/serviceAuth.js";

export function createAgentGatewayRoutes(
  controller: AgentGatewayController
): Router {
  const router = Router();

  // Protect ALL /internal routes with strict constant-time service token auth
  router.use(serviceAuthMiddleware);

  router.post("/quotations/drafts", controller.ingestQuotationDraft);
  router.post("/alerts", controller.ingestAlert);
  router.post("/recommendations", controller.ingestRecommendation);
  router.post("/monitoring-snapshots", controller.recordMonitoringSnapshot);
  router.post("/payment-followups", controller.ingestPaymentFollowup);
  router.post("/payment-reminder-drafts", controller.ingestPaymentReminderDraft);

  return router;
}
