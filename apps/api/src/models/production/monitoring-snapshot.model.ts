import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";

export interface IMonitoringSnapshotStage {
  stage: string;
  produced: number;
  percent: number;
}

export interface IMonitoringSnapshot extends BaseEntity {
  orderId: Types.ObjectId;
  snapshotDate: string;
  phase: string;
  percentComplete: number;
  byStage: IMonitoringSnapshotStage[];
  requiredDailyOutput: number;
  actualRate: number;
  projectedFinish: string;
  status: "on_track" | "at_risk" | "behind";
  stale: boolean;
  recommendations: string[];
  agentRunId?: Types.ObjectId;
}

const MonitoringSnapshotSchema = new Schema<IMonitoringSnapshot>(
  {
    tenantId: { type: String, required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, required: true, ref: "Order" },
    snapshotDate: { type: String, required: true },
    phase: { type: String, required: true },
    percentComplete: { type: Number, required: true },
    byStage: [
      {
        _id: false,
        stage: { type: String, required: true },
        produced: { type: Number, required: true },
        percent: { type: Number, required: true },
      },
    ],
    requiredDailyOutput: { type: Number, required: true },
    actualRate: { type: Number, required: true },
    projectedFinish: { type: String, required: true },
    status: {
      type: String,
      enum: ["on_track", "at_risk", "behind"],
      required: true,
    },
    stale: { type: Boolean, default: false },
    recommendations: [{ type: String }],
    agentRunId: { type: Schema.Types.ObjectId, ref: "AgentRun" },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

MonitoringSnapshotSchema.index({ tenantId: 1, orderId: 1, snapshotDate: -1 });

export const MonitoringSnapshotModel =
  mongoose.models.MonitoringSnapshot ||
  mongoose.model<IMonitoringSnapshot>("MonitoringSnapshot", MonitoringSnapshotSchema);
