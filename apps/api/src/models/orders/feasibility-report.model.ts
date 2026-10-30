import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";

export interface IProcessCheck {
  stage: string;
  labourCap: number;
  machineCap: number;
  load: number;
  free: number;
  days: number;
  start: string;
  end: string;
}

export interface IRiskFactor {
  type: string;
  severity: string;
}

export interface IMaterialRequirement {
  materialId: Types.ObjectId;
  req: number;
  avail: number;
  short: number;
}

export interface IRecoveryOptionDetails {
  supplier?: string;
  rate?: number;
  leadDays?: number;
  qty?: number;
  [key: string]: any;
}

export interface IRecoveryOption {
  optionId: string;
  type: string;
  details?: IRecoveryOptionDetails;
  etaEffect?: string;
  priceEffect?: number;
}

export interface IFeasibilityAdminDecision {
  choice: string;
  by: Types.ObjectId;
  at: Date;
}

export interface IFeasibilityReport extends BaseEntity {
  orderId: Types.ObjectId;
  version: number;
  status: "running" | "ready" | "failed" | "superseded";
  verdict: "feasible" | "at_risk" | "not_feasible";
  etaDate?: string;
  materialReadyDate?: string;
  bottleneckProcess?: string;
  processChecks: IProcessCheck[];
  riskFactors: IRiskFactor[];
  materialRequirements: IMaterialRequirement[];
  recoveryOptions: IRecoveryOption[];
  reasonsSummary?: string;
  lowData: boolean;
  dataBasis?: Record<string, any>;
  inputsSnapshot?: {
    capacity?: any;
    stock?: any;
    prices?: any;
  };
  adminDecision?: IFeasibilityAdminDecision;
  agentRunId?: Types.ObjectId;
}

const FeasibilityReportSchema = new Schema<IFeasibilityReport>(
  {
    tenantId: { type: String, required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, required: true, ref: "Order" },
    version: { type: Number, default: 1, required: true },
    status: {
      type: String,
      enum: ["running", "ready", "failed", "superseded"],
      default: "ready",
      required: true,
    },
    verdict: {
      type: String,
      enum: ["feasible", "at_risk", "not_feasible"],
      required: true,
    },
    etaDate: { type: String },
    materialReadyDate: { type: String },
    bottleneckProcess: { type: String },
    processChecks: [
      {
        _id: false,
        stage: { type: String, required: true },
        labourCap: { type: Number, required: true },
        machineCap: { type: Number, required: true },
        load: { type: Number, required: true },
        free: { type: Number, required: true },
        days: { type: Number, required: true },
        start: { type: String, required: true },
        end: { type: String, required: true },
      },
    ],
    riskFactors: [
      {
        _id: false,
        type: { type: String, required: true },
        severity: { type: String, required: true },
      },
    ],
    materialRequirements: [
      {
        _id: false,
        materialId: { type: Schema.Types.ObjectId, required: true, ref: "Material" },
        req: { type: Number, required: true },
        avail: { type: Number, required: true },
        short: { type: Number, required: true },
      },
    ],
    recoveryOptions: [
      {
        _id: false,
        optionId: { type: String, required: true },
        type: { type: String, required: true },
        details: { type: Schema.Types.Mixed },
        etaEffect: { type: String },
        priceEffect: { type: Number },
      },
    ],
    reasonsSummary: { type: String },
    lowData: { type: Boolean, default: false },
    dataBasis: { type: Schema.Types.Mixed },
    inputsSnapshot: {
      capacity: { type: Schema.Types.Mixed },
      stock: { type: Schema.Types.Mixed },
      prices: { type: Schema.Types.Mixed },
    },
    adminDecision: {
      choice: { type: String },
      by: { type: Schema.Types.ObjectId, ref: "User" },
      at: { type: Date },
    },
    agentRunId: { type: Schema.Types.ObjectId, ref: "AgentRun" },
  },
  { timestamps: true }
);

FeasibilityReportSchema.index({ tenantId: 1, orderId: 1, version: 1 }, { unique: true });

export const FeasibilityReportModel =
  mongoose.models.FeasibilityReport ||
  mongoose.model<IFeasibilityReport>("FeasibilityReport", FeasibilityReportSchema);
