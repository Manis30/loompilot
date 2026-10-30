import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";

export interface IWorkforceAreaHeadcount {
  area: string;
  present: number;
  absent: number;
  halfDay: number;
}

export interface ISupervisorResources {
  machinesAvail: number;
  machinesDown: number;
}

export interface ISupervisorStockCount {
  materialId: Types.ObjectId;
  qty: number;
}

export interface ISupervisorProduction {
  orderId: Types.ObjectId;
  stage: string;
  produced: number;
  defective: number;
}

export interface ISupervisorIssue {
  type: string;
  notes: string;
}

export interface ISupervisorCorrection {
  reason: string;
  by: Types.ObjectId;
  at: Date;
}

export interface ISupervisorDailyReport extends BaseEntity {
  supervisorId: Types.ObjectId;
  reportDate: string; // 'YYYY-MM-DD'
  processAreas: string[];
  workforce: IWorkforceAreaHeadcount[];
  employeesPresentTotal: number;
  resources?: ISupervisorResources;
  stockCounts: ISupervisorStockCount[];
  production: ISupervisorProduction[];
  issues: ISupervisorIssue[];
  status: "draft" | "submitted" | "corrected";
  submittedAt?: Date;
  isLate?: boolean;
  corrections: ISupervisorCorrection[];
  clientGeneratedId?: string; // offline sync
}

const SupervisorDailyReportSchema = new Schema<ISupervisorDailyReport>(
  {
    tenantId: { type: String, required: true, index: true },
    supervisorId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    reportDate: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, "Must be 'YYYY-MM-DD' format"],
    },
    processAreas: [{ type: String }],
    workforce: [
      {
        _id: false,
        area: { type: String, required: true },
        present: { type: Number, required: true, default: 0 },
        absent: { type: Number, required: true, default: 0 },
        halfDay: { type: Number, required: true, default: 0 },
      },
    ],
    employeesPresentTotal: { type: Number, required: true },
    resources: {
      machinesAvail: { type: Number, default: 0 },
      machinesDown: { type: Number, default: 0 },
    },
    stockCounts: [
      {
        _id: false,
        materialId: { type: Schema.Types.ObjectId, required: true, ref: "Material" },
        qty: { type: Number, required: true },
      },
    ],
    production: [
      {
        _id: false,
        orderId: { type: Schema.Types.ObjectId, required: true, ref: "Order" },
        stage: { type: String, required: true },
        produced: { type: Number, required: true },
        defective: { type: Number, required: true, default: 0 },
      },
    ],
    issues: [
      {
        _id: false,
        type: { type: String, required: true },
        notes: { type: String, required: true },
      },
    ],
    status: {
      type: String,
      enum: ["draft", "submitted", "corrected"],
      default: "submitted",
      required: true,
    },
    submittedAt: { type: Date, default: Date.now },
    isLate: { type: Boolean, default: false },
    corrections: [
      {
        _id: false,
        reason: { type: String, required: true },
        by: { type: Schema.Types.ObjectId, required: true, ref: "User" },
        at: { type: Date, default: Date.now },
      },
    ],
    clientGeneratedId: { type: String },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

SupervisorDailyReportSchema.index(
  { tenantId: 1, supervisorId: 1, reportDate: 1 },
  { unique: true }
);

export const SupervisorDailyReportModel =
  mongoose.models.SupervisorDailyReport ||
  mongoose.model<ISupervisorDailyReport>("SupervisorDailyReport", SupervisorDailyReportSchema);
