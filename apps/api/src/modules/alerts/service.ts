import mongoose from "mongoose";
import { AlertModel, IAlert, RecommendationModel, IRecommendation } from "./model.js";
import { RecommendationStatus } from "@loompilot/shared";
import { broadcastAlert } from "../../realtime/socket.js";

export class AlertService {
  static async listAlerts(tenantId: string): Promise<IAlert[]> {
    return AlertModel.find({ tenantId }).sort({ createdAt: -1 });
  }

  static async createAlert(data: Partial<IAlert> & { tenantId: string }): Promise<IAlert> {
    const alert = await AlertModel.findOneAndUpdate(
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
      { upsert: true, new: true, runValidators: true }
    );

    // Push alert via Socket.IO to connected dashboards
    broadcastAlert(data.tenantId, alert);

    return alert;
  }

  static async acknowledgeAlert(tenantId: string, id: string): Promise<IAlert | null> {
    return AlertModel.findOneAndUpdate(
      { _id: id, tenantId },
      { isAcknowledged: true },
      { new: true }
    );
  }

  static async listRecommendations(tenantId: string): Promise<IRecommendation[]> {
    return RecommendationModel.find({ tenantId }).sort({ createdAt: -1 });
  }

  static async createRecommendation(
    data: Partial<IRecommendation> & { tenantId: string }
  ): Promise<IRecommendation> {
    return RecommendationModel.create(data);
  }

  static async decideRecommendation(
    tenantId: string,
    id: string,
    userId: string,
    action: "accept" | "reject",
    selectedOptionId?: string,
    rejectionReason?: string
  ): Promise<IRecommendation | null> {
    const rec = await RecommendationModel.findOne({ _id: id, tenantId });
    if (!rec) throw new Error("Recommendation not found");

    rec.status = action === "accept" ? RecommendationStatus.ACCEPTED : RecommendationStatus.REJECTED;
    rec.decidedBy = new mongoose.Types.ObjectId(userId);
    rec.decidedAt = new Date();

    if (action === "accept" && selectedOptionId) {
      rec.selectedOptionId = selectedOptionId;
    }
    if (action === "reject" && rejectionReason) {
      rec.rejectionReason = rejectionReason;
    }

    await rec.save();
    return rec;
  }
}
