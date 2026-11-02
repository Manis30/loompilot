import { Router } from "express";
import { InternalGatewayController } from "../controllers/internal-gateway.controller.js";
import { verifyInternalSecret } from "../middleware/internal-auth.js";
import { validateBody } from "../validators/index.js";
import {
  InternalFeasibilityReportSchema,
  InternalQuotationDraftSchema,
  InternalQuotationRevisionSchema,
  InternalMonitoringSnapshotSchema,
} from "@loompilot/shared";

export const internalGatewayRouter: Router = Router();
const controller = new InternalGatewayController();

internalGatewayRouter.use(verifyInternalSecret);

internalGatewayRouter.post(
  "/feasibility-reports",
  validateBody(InternalFeasibilityReportSchema),
  controller.ingestFeasibilityReport
);

internalGatewayRouter.post(
  "/quotation-drafts",
  validateBody(InternalQuotationDraftSchema),
  controller.ingestQuotationDraft
);

internalGatewayRouter.post(
  "/quotation-revisions",
  validateBody(InternalQuotationRevisionSchema),
  controller.ingestQuotationRevision
);

internalGatewayRouter.post(
  "/monitoring-snapshots",
  validateBody(InternalMonitoringSnapshotSchema),
  controller.ingestMonitoringSnapshot
);
