import { logger } from "../config/logger.js";
import { MonitoringJobPayload, PaymentFollowupPayload } from "./queues.js";

export async function processMonitoringJob(payload: MonitoringJobPayload): Promise<void> {
  logger.info(
    { tenantId: payload.tenantId, orderId: payload.orderId },
    "Processing monitoring check job"
  );
  // Agents service or internal check is invoked here when running in full production
}

export async function processPaymentFollowupJob(payload: PaymentFollowupPayload): Promise<void> {
  logger.info(
    { tenantId: payload.tenantId, deliveryId: payload.deliveryId },
    "Processing payment follow-up creation job"
  );
  // Agents service payment agent is notified here
}
