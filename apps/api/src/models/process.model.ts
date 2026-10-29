import mongoose, { Schema, Document } from "mongoose";
import { ProcessName } from "@loompilot/shared";

export interface IProcessDocument extends Document {
  tenantId: string;
  name: ProcessName;
  sequence: number;
  standardWastagePct: number;
  avgOutputPerWorkerHour: number;
  unit: string;
  costPerUnitPaise: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProcessSchema = new Schema<IProcessDocument>(
  {
    tenantId: { type: String, required: true, index: true },
    name: { type: String, enum: Object.values(ProcessName), required: true },
    sequence: { type: Number, required: true },
    standardWastagePct: { type: Number, required: true, default: 2.0 },
    avgOutputPerWorkerHour: { type: Number, required: true, default: 10 },
    unit: { type: String, required: true, default: "meters" },
    costPerUnitPaise: { type: Number, default: 0, min: 0 },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

ProcessSchema.index({ tenantId: 1, name: 1 }, { unique: true });
ProcessSchema.index({ tenantId: 1, sequence: 1 });

export const ProcessModel = mongoose.model<IProcessDocument>("Process", ProcessSchema);

