import { AlertSeverity, AlertType, RecommendationStatus } from "@loompilot/shared";
import { TxContext } from "./unit-of-work.js";
import { ListQuery, Page } from "../utils/pagination.js";

export interface AlertMetrics {
  requiredDaily: number;
  actualRate: number;
  deficitQty: number;
  delayDaysEstimated: number;
}

export interface Alert {
  id: string;
  tenantId: string;
  orderId: string;
  processId: string;
  date: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  metrics: AlertMetrics;
  isAcknowledged: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewAlert {
  tenantId: string;
  orderId: string;
  processId: string;
  date: string;
  type: AlertType;
  severity?: AlertSeverity;
  title: string;
  message: string;
  metrics: AlertMetrics;
}

export interface RecoveryOption {
  id: string;
  title: string;
  description: string;
  extraWorkersNeeded?: number;
  revisedDailyTarget?: number;
  projectedCatchupDays?: number;
  additionalCostPaise: number;
}

export interface Recommendation {
  id: string;
  tenantId: string;
  alertId: string;
  orderId: string;
  status: RecommendationStatus;
  title: string;
  explanation: string;
  options: RecoveryOption[];
  selectedOptionId?: string;
  decidedBy?: string;
  decidedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewRecommendation {
  tenantId: string;
  alertId: string;
  orderId: string;
  title: string;
  explanation: string;
  options: RecoveryOption[];
  status?: RecommendationStatus;
}

export interface IAlertRepository {
  upsertAlert(data: NewAlert, tx?: TxContext): Promise<Alert>;
  findAlertById(tenantId: string, id: string, tx?: TxContext): Promise<Alert | null>;
  listAlerts(tenantId: string, query?: ListQuery): Promise<Page<Alert>>;
  acknowledgeAlert(tenantId: string, id: string, tx?: TxContext): Promise<Alert | null>;
  createRecommendation(data: NewRecommendation, tx?: TxContext): Promise<Recommendation>;
  findRecommendationById(tenantId: string, id: string, tx?: TxContext): Promise<Recommendation | null>;
  listRecommendations(tenantId: string, query?: ListQuery): Promise<Page<Recommendation>>;
  decideRecommendation(
    tenantId: string,
    id: string,
    data: {
      status: RecommendationStatus;
      decidedBy: string;
      decidedAt: Date;
      selectedOptionId?: string;
      rejectionReason?: string;
    },
    tx?: TxContext
  ): Promise<Recommendation | null>;
}
