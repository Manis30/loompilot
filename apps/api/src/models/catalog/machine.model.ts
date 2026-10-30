import mongoose, { Schema } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";

export interface IMachine extends BaseEntity {
  machineCode: string;
  machineName: string;
  machineType: string;
  processArea: string;
  capacityUnitsPerDay: number;
  currentStatus: "available" | "maintenance" | "breakdown";
}

const MachineSchema = new Schema<IMachine>(
  {
    tenantId: { type: String, required: true, index: true },
    machineCode: { type: String, required: true, uppercase: true, trim: true },
    machineName: { type: String, required: true, trim: true },
    machineType: { type: String, required: true, trim: true },
    processArea: { type: String, required: true, trim: true },
    capacityUnitsPerDay: { type: Number, required: true },
    currentStatus: {
      type: String,
      enum: ["available", "maintenance", "breakdown"],
      default: "available",
      required: true,
    },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

MachineSchema.index({ tenantId: 1, machineCode: 1 }, { unique: true });
MachineSchema.index({ tenantId: 1, currentStatus: 1 });

export const MachineModel =
  mongoose.models.Machine || mongoose.model<IMachine>("Machine", MachineSchema);
