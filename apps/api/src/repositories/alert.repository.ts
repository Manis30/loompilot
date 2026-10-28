import {
  IAlertRepository,
  Alert,
  NewAlert,
  Recommendation,
  NewRecommendation,
} from "../interfaces/alert.repository.js";
import { TxContext } from "../interfaces/unit-of-work.js";
import { ListQuery, Page, toPage } from "../utils/pagination.js";
import { AlertModel, RecommendationModel } from "../models/alert.model.js";
import { RecommendationStatus } from "@loompilot/shared";

export class MongoAlertRepository implements IAlertRepository {
  private toAlert(doc: any): Alert {
    return {
      id: doc._id.toString(),
      tenantId: doc.tenantId,
      orderId: doc.orderId.toString(),
      processId: doc.processId.toString(),
      date: doc.date,
      type: doc.type,
      severity: doc.severity,
      title: doc.title,
      message: doc.message,
      metrics: doc.metrics,
      isAcknowledged: doc.isAcknowledged,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  private toRecommendation(doc: any): Recommendation {
    return {
      id: doc._id.toString(),
      tenantId: doc.tenantId,
      alertId: doc.alertId.toString(),
      orderId: doc.orderId.toString(),
      status: doc.status,
      title: doc.title,
      explanation: doc.explanation,
      options: doc.options || [],
      selectedOptionId: doc.selectedOptionId,
      decidedBy: doc.decidedBy?.toString(),
      decidedAt: doc.decidedAt,
      rejectionReason: doc.rejectionReason,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async upsertAlert(data: NewAlert, tx?: TxContext): Promise<Alert> {
    const doc = await AlertModel.findOneAndUpdate(
      {
        tenantId: data.tenantId,
        orderId: data.orderId,
        processId: data.processId,
        date: data.date,
        type: data.type,
      },
      {
        $set: {
          severity: data.severity,
          title: data.title,
          message: data.message,
          metrics: data.metrics,
        },
      },
      { upsert: true, new: true, runValidators: true, session: tx?.session || null }
    ).lean();
    return this.toAlert(doc);
  }

  async findAlertById(tenantId: string, id: string, tx?: TxContext): Promise<Alert | null> {
    const doc = await AlertModel.findOne({ _id: id, tenantId })
      .session(tx?.session || null)
      .lean();
    return doc ? this.toAlert(doc) : null;
  }

  async listAlerts(tenantId: string, query?: ListQuery): Promise<Page<Alert>> {
    const page = query?.page || 1;
    const limit = query?.limit || 50;
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      AlertModel.find({ tenantId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AlertModel.countDocuments({ tenantId }),
    ]);

    return toPage(
      docs.map((d) => this.toAlert(d)),
      total,
      page,
      limit
    );
  }

  async acknowledgeAlert(tenantId: string, id: string, tx?: TxContext): Promise<Alert | null> {
    const doc = await AlertModel.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: { isAcknowledged: true } },
      { new: true, session: tx?.session || null }
    ).lean();
    return doc ? this.toAlert(doc) : null;
  }

  async createRecommendation(
    data: NewRecommendation,
    tx?: TxContext
  ): Promise<Recommendation> {
    const docs = await RecommendationModel.create([data], { session: tx?.session || null });
    return this.toRecommendation(docs[0]!);
  }

  async findRecommendationById(
    tenantId: string,
    id: string,
    tx?: TxContext
  ): Promise<Recommendation | null> {
    const doc = await RecommendationModel.findOne({ _id: id, tenantId })
      .session(tx?.session || null)
      .lean();
    return doc ? this.toRecommendation(doc) : null;
  }

  async listRecommendations(tenantId: string, query?: ListQuery): Promise<Page<Recommendation>> {
    const page = query?.page || 1;
    const limit = query?.limit || 50;
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      RecommendationModel.find({ tenantId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      RecommendationModel.countDocuments({ tenantId }),
    ]);

    return toPage(
      docs.map((d) => this.toRecommendation(d)),
      total,
      page,
      limit
    );
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
    },
    tx?: TxContext
  ): Promise<Recommendation | null> {
    const doc = await RecommendationModel.findOneAndUpdate(
      { _id: id, tenantId },
      {
        $set: {
          status: data.status,
          decidedBy: data.decidedBy,
          decidedAt: data.decidedAt,
          selectedOptionId: data.selectedOptionId,
          rejectionReason: data.rejectionReason,
        },
      },
      { new: true, session: tx?.session || null }
    ).lean();
    return doc ? this.toRecommendation(doc) : null;
  }
}
