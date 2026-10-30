import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";

export interface IWorkforceAreaHeadcount {
  area: string;
  count: number;
}

export interface ISupervisorResources {
  machinesAvail: number;
  machinesDown?: number;
}

export interface ISupervisorStockCount {
  materialId: Types.ObjectId;
  qty: number;
}

export interface ISupervisorOutput {
  orderId: Types.ObjectId;
  stage: string;
  produced: number;
  defective?: number;
}

export interface ISupervisorMachineStatus {
  machineId: Types.ObjectId;
  status: "available" | "maint" | "breakdown";
  hours: number;
  remarks?: string;
}

export interface ISupervisorIssue {
  type: "machine" | "shortage" | "delay" | "quality" | "other";
  notes: string;
  machineId?: Types.ObjectId;
}

export interface ISupervisorCorrection {
  reason: string;
  by: Types.ObjectId;
  at: Date;
}

export interface ISupervisorDailyReport extends BaseEntity {
  reportDate: string; // YYYY-MM-DD
  supervisorId: Types.ObjectId;
  processAreas: string[];
  employeesPresentTotal: number;
  workforce?: IWorkforceAreaHeadcount[];
  resources?: ISupervisorResources;
  stockCounts?: ISupervisorStockCount[];
  outputs?: ISupervisorOutput[];
  machines?: ISupervisorMachineStatus[];
  issues?: ISupervisorIssue[];
  status: "draft" | "submitted" | "corrected";
  submittedAt?: Date;
  isLate?: boolean;
  corrections?: ISupervisorCorrection[];
  clientGeneratedId?: string;
}

const WorkforceSchema = new Schema<IWorkforceAreaHeadcount>(
  {
    area: { type: String, required: true },
    count: { type: Number, required: true },
  },
  { _id: false, strict: true }
);

const ResourcesSchema = new Schema<ISupervisorResources>(
  {
    machinesAvail: { type: Number, required: true },
    machinesDown: { type: Number, default: 0 },
  },
  { _id: false, strict: true }
);

const StockCountSchema = new Schema<ISupervisorStockCount>(
  {
    materialId: { type: Schema.Types.ObjectId, ref: "Material", required: true },
    qty: { type: Number, required: true },
  },
  { _id: false, strict: true }
);

const OutputSchema = new Schema<ISupervisorOutput>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    stage: { type: String, required: true },
    produced: { type: Number, required: true },
    defective: { type: Number, default: 0 },
  },
  { _id: false, strict: true }
);

const MachineStatusSchema = new Schema<ISupervisorMachineStatus>(
  {
    machineId: { type: Schema.Types.ObjectId, ref: "Machine", required: true },
    status: {
      type: String,
      enum: ["available", "maint", "breakdown"],
      required: true,
    },
    hours: { type: Number, required: true },
    remarks: { type: String },
  },
  { _id: false, strict: true }
);

const IssueSchema = new Schema<ISupervisorIssue>(
  {
    type: {
      type: String,
      enum: ["machine", "shortage", "delay", "quality", "other"],
      required: true,
    },
    notes: { type: String, required: true },
    machineId: { type: Schema.Types.ObjectId, ref: "Machine" },
  },
  { _id: false, strict: true }
);

const CorrectionSchema = new Schema<ISupervisorCorrection>(
  {
    reason: { type: String, required: true },
    by: { type: Schema.Types.ObjectId, ref: "User", required: true },
    at: { type: Date, required: true },
  },
  { _id: false, strict: true }
);

const SupervisorDailyReportSchema = new Schema<ISupervisorDailyReport>(
  {
    tenantId: { type: String, required: true, index: true },
    reportDate: { type: String, required: true },
    supervisorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    processAreas: { type: [String], required: true },
    employeesPresentTotal: { type: Number, required: true },
    workforce: { type: [WorkforceSchema] },
    resources: { type: ResourcesSchema },
    stockCounts: { type: [StockCountSchema] },
    outputs: { type: [OutputSchema] },
    machines: { type: [MachineStatusSchema] },
    issues: { type: [IssueSchema] },
    status: {
      type: String,
      enum: ["draft", "submitted", "corrected"],
      default: "draft",
      required: true,
    },
    submittedAt: { type: Date },
    isLate: { type: Boolean, default: false },
    corrections: { type: [CorrectionSchema] },
    clientGeneratedId: { type: String },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

// Rule 10: workforce sum == employeesPresentTotal when present
SupervisorDailyReportSchema.path("workforce").validate(function (this: any, workforce: any[]) {
  if (workforce && Array.isArray(workforce) && workforce.length > 0) {
    const sum = workforce.reduce((acc: number, w: any) => acc + (w.count || 0), 0);
    return sum === this?.employeesPresentTotal;
  }
  return true;
}, "Workforce count sum must equal employeesPresentTotal");

SupervisorDailyReportSchema.index(
  { tenantId: 1, supervisorId: 1, reportDate: 1 },
  { unique: true }
);
SupervisorDailyReportSchema.index({ tenantId: 1, "outputs.orderId": 1, reportDate: 1 });
SupervisorDailyReportSchema.index(
  { tenantId: 1, clientGeneratedId: 1 },
  {
    unique: true,
    partialFilterExpression: { clientGeneratedId: { $type: "string" } },
  }
);

export const SupervisorDailyReportModel: mongoose.Model<ISupervisorDailyReport> =
  (mongoose.models.SupervisorDailyReport as mongoose.Model<ISupervisorDailyReport>) ||
  mongoose.model<ISupervisorDailyReport>("SupervisorDailyReport", SupervisorDailyReportSchema);
