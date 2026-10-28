import { Alert, Recommendation } from "../interfaces/alert.repository.js";

export function toAlertResponse(alert: Alert) {
  return {
    id: alert.id,
    _id: alert.id,
    tenantId: alert.tenantId,
    orderId: alert.orderId,
    processId: alert.processId,
    date: alert.date,
    type: alert.type,
    severity: alert.severity,
    title: alert.title,
    message: alert.message,
    metrics: alert.metrics,
    isAcknowledged: alert.isAcknowledged,
    createdAt: alert.createdAt,
    updatedAt: alert.updatedAt,
  };
}

export function toRecommendationResponse(rec: Recommendation) {
  return {
    id: rec.id,
    _id: rec.id,
    tenantId: rec.tenantId,
    alertId: rec.alertId,
    orderId: rec.orderId,
    status: rec.status,
    title: rec.title,
    explanation: rec.explanation,
    options: rec.options,
    selectedOptionId: rec.selectedOptionId,
    decidedBy: rec.decidedBy,
    decidedAt: rec.decidedAt,
    rejectionReason: rec.rejectionReason,
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
  };
}

