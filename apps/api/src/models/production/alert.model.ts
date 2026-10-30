import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";

export interface IAlert extends BaseEntity {
  type: "behind" | "missing_report" | "stale" | string;
  orderId?: Types.ObjectId;
  supervisorId?: Types.ObjectId;
  materialId?: Types.ObjectId;
  severity: "low" | "medium" | "high" | "critical" | string;
  message: string;
  recoverySuggestions: string[];
  status: "open" | "resolved";
  agentRunId?: Types.ObjectId;
}

const AlertSchema = new Schema<IAlert>(
  {
    tenantId: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ["behind", "missing_report", "stale"],
      required: true,
    },
    orderId: { type: Schema.Types.ObjectId, ref: "Order" },
    supervisorId: { type: Schema.Types.ObjectId, ref: "User" },
    materialId: { type: Schema.Types.ObjectId, ref: "Material" },
    severity: { type: String, required: true },
    message: { type: String, required: true },
    recoverySuggestions: [{ type: String }],
    status: {
      type: String,
      enum: ["open", "resolved"],
      default: "open",
      required: true,
    },
    agentRunId: { type: Schema.Types.ObjectId, ref: "AgentRun" },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

AlertSchema.index({ tenantId: 1, status: 1 });
AlertSchema.index({ tenantId: 1, orderId: 1 });

export const AlertModel = mongoose.models.Alert || mongoose.model<IAlert>("Alert", AlertSchema);
