import { describe, it, expect, beforeEach } from "vitest";
import { AlertService } from "../../src/services/alert.service.js";
import {
  IAlertRepository,
  Alert,
  NewAlert,
  Recommendation,
  NewRecommendation,
} from "../../src/interfaces/alert.repository.js";
import { FakeUnitOfWork } from "../fakes/fake-unit-of-work.js";
import { ListQuery, Page, toPage } from "../../src/utils/pagination.js";
import { Actor } from "../../src/utils/actor.js";
import { AlertSeverity, AlertType, RecommendationStatus, UserRole } from "@loompilot/shared";
import { NotFoundError } from "../../src/errors/index.js";

class FakeAlertRepository implements IAlertRepository {
  private alerts: Alert[] = [];
  private recommendations: Recommendation[] = [];

  async upsertAlert(data: NewAlert): Promise<Alert> {
    let existing = this.alerts.find(
      (a) =>
        a.tenantId === data.tenantId &&
        a.orderId === data.orderId &&
        a.processId === data.processId &&
        a.date === data.date &&
        a.type === data.type
    );
    if (existing) {
      existing.severity = data.severity ?? AlertSeverity.MEDIUM;
      existing.title = data.title;
      existing.message = data.message;
      existing.metrics = data.metrics;
      existing.updatedAt = new Date();
      return existing;
    }

    const alert: Alert = {
      id: `alt_${Date.now()}_${Math.random()}`,
      tenantId: data.tenantId,
      orderId: data.orderId,
      processId: data.processId,
      date: data.date,
      type: data.type,
      severity: data.severity ?? AlertSeverity.MEDIUM,
      title: data.title,
      message: data.message,
      metrics: data.metrics,
      isAcknowledged: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.alerts.push(alert);
    return alert;
  }

  async findAlertById(tenantId: string, id: string): Promise<Alert | null> {
    return this.alerts.find((a) => a.tenantId === tenantId && a.id === id) || null;
  }

  async listAlerts(tenantId: string, query?: ListQuery): Promise<Page<Alert>> {
    const filtered = this.alerts.filter((a) => a.tenantId === tenantId);
    return toPage(filtered, filtered.length, query?.page || 1, query?.limit || 50);
  }

  async acknowledgeAlert(tenantId: string, id: string): Promise<Alert | null> {
    const alert = await this.findAlertById(tenantId, id);
    if (!alert) return null;
    alert.isAcknowledged = true;
    alert.updatedAt = new Date();
    return alert;
  }

  async createRecommendation(data: NewRecommendation): Promise<Recommendation> {
    const rec: Recommendation = {
      id: `rec_${Date.now()}_${Math.random()}`,
      tenantId: data.tenantId,
      alertId: data.alertId,
      orderId: data.orderId,
      status: data.status || RecommendationStatus.PROPOSED,
      title: data.title,
      explanation: data.explanation,
      options: data.options,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.recommendations.push(rec);
    return rec;
  }

  async findRecommendationById(tenantId: string, id: string): Promise<Recommendation | null> {
    return this.recommendations.find((r) => r.tenantId === tenantId && r.id === id) || null;
  }

  async listRecommendations(tenantId: string, query?: ListQuery): Promise<Page<Recommendation>> {
    const filtered = this.recommendations.filter((r) => r.tenantId === tenantId);
    return toPage(filtered, filtered.length, query?.page || 1, query?.limit || 50);
  }

  async decideRecommendation(
    tenantId: string,
    id: string,
    data: {
      status: RecommendationStatus;
      decidedBy: string;
      decidedAt: Date;
      selectedOptionId?: string;
      rejectionReason?: string;
    }
  ): Promise<Recommendation | null> {
    const rec = await this.findRecommendationById(tenantId, id);
    if (!rec) return null;
    rec.status = data.status;
    rec.decidedBy = data.decidedBy;
    rec.decidedAt = data.decidedAt;
    if (data.selectedOptionId) rec.selectedOptionId = data.selectedOptionId;
    if (data.rejectionReason) rec.rejectionReason = data.rejectionReason;
    rec.updatedAt = new Date();
    return rec;
  }
}

describe("Unit: AlertService", () => {
  let fakeRepo: FakeAlertRepository;
  let fakeUow: FakeUnitOfWork;
  let service: AlertService;
  const actor: Actor = {
    userId: "usr_mgr",
    email: "manager@loompilot.test",
    role: UserRole.MANAGER,
    tenantId: "tenant_alt_unit",
  };

  beforeEach(() => {
    fakeRepo = new FakeAlertRepository();
    fakeUow = new FakeUnitOfWork();
    service = new AlertService(fakeRepo, fakeUow);
  });

  it("creates and deduplicates alert per order + process + date + type", async () => {
    const a1 = await service.createAlert(actor, {
      orderId: "ord_1",
      processId: "proc_1",
      date: "2026-10-28",
      type: AlertType.DAILY_TARGET_DEFICIT,
      severity: AlertSeverity.HIGH,
      title: "Deficit Alert",
      message: "Behind target by 100 meters",
      metrics: {
        requiredDaily: 250,
        actualRate: 150,
        deficitQty: 100,
        delayDaysEstimated: 1.5,
      },
    });

    expect(a1.id).toBeDefined();

    // Calling again with same composite key should update instead of creating duplicate
    const a2 = await service.createAlert(actor, {
      orderId: "ord_1",
      processId: "proc_1",
      date: "2026-10-28",
      type: AlertType.DAILY_TARGET_DEFICIT,
      severity: AlertSeverity.CRITICAL,
      title: "Deficit Alert Updated",
      message: "Behind target by 120 meters",
      metrics: {
        requiredDaily: 250,
        actualRate: 130,
        deficitQty: 120,
        delayDaysEstimated: 2.0,
      },
    });

    expect(a2.id).toBe(a1.id);
    expect(a2.severity).toBe(AlertSeverity.CRITICAL);
  });

  it("decides a recommendation: accept option or reject with reason", async () => {
    const rec = await service.createRecommendation(actor, {
      alertId: "alt_1",
      orderId: "ord_1",
      title: "Recovery Plan",
      explanation: "Add 2 temporary workers to catch up",
      options: [
        {
          id: "opt_1",
          title: "Add 2 temporary workers",
          description: "2 extra workers for 3 days",
          extraWorkersNeeded: 2,
          additionalCostPaise: 500000,
        },
      ],
    });

    expect(rec.status).toBe(RecommendationStatus.PROPOSED);

    const accepted = await service.decideRecommendation(actor, rec.id, {
      action: "accept",
      selectedOptionId: "opt_1",
    });

    expect(accepted.status).toBe(RecommendationStatus.ACCEPTED);
    expect(accepted.selectedOptionId).toBe("opt_1");
    expect(accepted.decidedBy).toBe(actor.userId);
  });
});

