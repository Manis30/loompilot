import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";

export interface IPriceAlert extends BaseEntity {
  materialId: Types.ObjectId;
  priceHistoryId: Types.ObjectId;
  change1d: number;
  change7d: number;
  thresholdBreached: string;
  affectedOrderIds: Types.ObjectId[];
  status: "open" | "ack" | "resolved" | "dismissed";
  acknowledgedBy?: Types.ObjectId;
  agentRunId?: Types.ObjectId;
}

const PriceAlertSchema = new Schema<IPriceAlert>(
  {
    tenantId: { type: String, required: true, index: true },
    materialId: { type: Schema.Types.ObjectId, required: true, ref: "Material" },
    priceHistoryId: { type: Schema.Types.ObjectId, required: true, ref: "PriceHistory" },
    change1d: { type: Number, required: true },
    change7d: { type: Number, required: true },
    thresholdBreached: { type: String, required: true },
    affectedOrderIds: [{ type: Schema.Types.ObjectId, ref: "Order" }],
    status: {
      type: String,
      enum: ["open", "ack", "resolved", "dismissed"],
      default: "open",
      required: true,
    },
    acknowledgedBy: { type: Schema.Types.ObjectId, ref: "User" },
    agentRunId: { type: Schema.Types.ObjectId, ref: "AgentRun" },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

PriceAlertSchema.index({ tenantId: 1, status: 1 });
PriceAlertSchema.index({ tenantId: 1, materialId: 1, createdAt: -1 });

export const PriceAlertModel =
  mongoose.models.PriceAlert || mongoose.model<IPriceAlert>("PriceAlert", PriceAlertSchema);
