import {
  IAlertRepository,
  Alert,
  Recommendation,
} from "../interfaces/alert.repository.js";
import { IUnitOfWork } from "../interfaces/unit-of-work.js";
import { IAuditLogRepository } from "../interfaces/audit-log.js";
import { Actor } from "../utils/actor.js";
import { ListQuery, Page } from "../utils/pagination.js";
import {
  CreateAlertInput,
  CreateRecommendationInput,
  DecideRecommendationInput,
} from "../validators/alert.validator.js";
import { NotFoundError } from "../errors/index.js";
import { RecommendationStatus } from "@loompilot/shared";
import { broadcastAlert } from "../realtime/socket.js";

export class AlertService {
  constructor(
    private readonly repo: IAlertRepository,
    _uow?: IUnitOfWork,
    private readonly audit?: IAuditLogRepository
  ) {}

  async listAlerts(actor: Actor, query?: ListQuery): Promise<Page<Alert>> {
    return this.repo.listAlerts(actor.tenantId, query);
  }

  async createAlert(actor: Actor, input: CreateAlertInput): Promise<Alert> {
    const alert = await this.repo.upsertAlert({
      tenantId: actor.tenantId,
      orderId: input.orderId,
      processId: input.processId,
      date: input.date,
      type: input.type,
      severity: input.severity,
      title: input.title,
      message: input.message,
      metrics: input.metrics,
    });

    // Realtime broadcast via Socket.IO
    broadcastAlert(actor.tenantId, alert);

    if (this.audit) {
      await this.audit.record({
        tenantId: actor.tenantId,
        userId: actor.userId,
        userRole: actor.role,
        action: "ALERT_CREATED",
        entity: "alert",
        entityId: alert.id,
        changes: { type: alert.type, severity: alert.severity, title: alert.title },
      });
    }

    return alert;
  }

  async acknowledgeAlert(actor: Actor, id: string): Promise<Alert> {
    const alert = await this.repo.acknowledgeAlert(actor.tenantId, id);
    if (!alert) {
      throw new NotFoundError(`Alert with ID ${id} not found`);
    }

    if (this.audit) {
      await this.audit.record({
        tenantId: actor.tenantId,
        userId: actor.userId,
        userRole: actor.role,
        action: "ALERT_ACKNOWLEDGED",
        entity: "alert",
        entityId: id,
      });
    }

    return alert;
  }

  async listRecommendations(
    actor: Actor,
    query?: ListQuery
  ): Promise<Page<Recommendation>> {
    return this.repo.listRecommendations(actor.tenantId, query);
  }

  async createRecommendation(
    actor: Actor,
    input: CreateRecommendationInput
  ): Promise<Recommendation> {
    const rec = await this.repo.createRecommendation({
      tenantId: actor.tenantId,
      alertId: input.alertId,
      orderId: input.orderId,
      title: input.title,
      explanation: input.explanation,
      options: input.options,
      status: RecommendationStatus.PROPOSED,
    });

    if (this.audit) {
      await this.audit.record({
        tenantId: actor.tenantId,
        userId: actor.userId,
        userRole: actor.role,
        action: "RECOMMENDATION_CREATED",
        entity: "recommendation",
        entityId: rec.id,
        changes: { title: rec.title },
      });
    }

    return rec;
  }

  async decideRecommendation(
    actor: Actor,
    id: string,
    input: DecideRecommendationInput
  ): Promise<Recommendation> {
    const existing = await this.repo.findRecommendationById(actor.tenantId, id);
    if (!existing) {
      throw new NotFoundError(`Recommendation with ID ${id} not found`);
    }

    const status =
      input.action === "accept"
        ? RecommendationStatus.ACCEPTED
        : RecommendationStatus.REJECTED;

    const updated = await this.repo.decideRecommendation(actor.tenantId, id, {
      status,
      decidedBy: actor.userId,
      decidedAt: new Date(),
      selectedOptionId: input.selectedOptionId,
      rejectionReason: input.rejectionReason,
    });

    if (this.audit) {
      await this.audit.record({
        tenantId: actor.tenantId,
        userId: actor.userId,
        userRole: actor.role,
        action: `RECOMMENDATION_${status.toUpperCase()}`,
        entity: "recommendation",
        entityId: id,
        changes: { status, selectedOptionId: input.selectedOptionId },
      });
    }

    return updated!;
  }
}
