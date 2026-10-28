import mongoose, { Schema, Document } from "mongoose";
import { AlertSeverity, AlertType, RecommendationStatus } from "@loompilot/shared";

// 1. Alert Model (Deduplicated per order + process + date + type)
export interface IAlert extends Document {
  tenantId: string;
  orderId: mongoose.Types.ObjectId;
  processId: mongoose.Types.ObjectId;
  date: string; // YYYY-MM-DD
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  metrics: {
    requiredDaily: number;
    actualRate: number;
    deficitQty: number;
    delayDaysEstimated: number;
  };
  isAcknowledged: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AlertSchema = new Schema<IAlert>(
  {
    tenantId: { type: String, required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: "ProductionOrder", required: true, index: true },
    processId: { type: Schema.Types.ObjectId, ref: "Process", required: true, index: true },
    date: { type: String, required: true },
    type: { type: String, enum: Object.values(AlertType), required: true },
    severity: { type: String, enum: Object.values(AlertSeverity), default: AlertSeverity.MEDIUM },
    title: { type: String, required: true },
    message: { type: String, required: true },
    metrics: {
      requiredDaily: { type: Number, required: true },
      actualRate: { type: Number, required: true },
      deficitQty: { type: Number, required: true },
      delayDaysEstimated: { type: Number, required: true },
    },
    isAcknowledged: { type: Boolean, default: false },
  },
  { timestamps: true }
);

AlertSchema.index({ tenantId: 1, orderId: 1, processId: 1, date: 1, type: 1 }, { unique: true });
AlertSchema.index({ tenantId: 1, createdAt: -1 });

export const AlertModel = mongoose.model<IAlert>("Alert", AlertSchema);

// 2. Recommendation Model
export interface IRecoveryOption {
  id: string;
  title: string;
  description: string;
  extraWorkersNeeded?: number;
  revisedDailyTarget?: number;
  projectedCatchupDays?: number;
  additionalCostPaise: number;
}

export interface IRecommendation extends Document {
  tenantId: string;
  alertId: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  status: RecommendationStatus;
  title: string;
  explanation: string;
  options: IRecoveryOption[];
  selectedOptionId?: string;
  decidedBy?: mongoose.Types.ObjectId;
  decidedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RecoveryOptionSchema = new Schema<IRecoveryOption>(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    extraWorkersNeeded: { type: Number },
    revisedDailyTarget: { type: Number },
    projectedCatchupDays: { type: Number },
    additionalCostPaise: { type: Number, default: 0 },
  },
  { _id: false }
);

const RecommendationSchema = new Schema<IRecommendation>(
  {
    tenantId: { type: String, required: true, index: true },
    alertId: { type: Schema.Types.ObjectId, ref: "Alert", required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: "ProductionOrder", required: true, index: true },
    status: {
      type: String,
      enum: Object.values(RecommendationStatus),
      default: RecommendationStatus.PROPOSED,
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    explanation: { type: String, required: true },
    options: [RecoveryOptionSchema],
    selectedOptionId: { type: String },
    decidedBy: { type: Schema.Types.ObjectId, ref: "User" },
    decidedAt: { type: Date },
    rejectionReason: { type: String },
  },
  { timestamps: true }
);

export const RecommendationModel = mongoose.model<IRecommendation>(
  "Recommendation",
  RecommendationSchema
);
