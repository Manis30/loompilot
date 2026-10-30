import mongoose, { Schema } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";

export interface IMachine extends BaseEntity {
  machineCode: string;
  machineName: string;
  processArea: string;
  capacityUnitsPerDay: number;
  currentStatus: "available" | "maint" | "breakdown";
  machineType?: string;
}

const MachineSchema = new Schema<IMachine>(
  {
    tenantId: { type: String, required: true, index: true },
    machineCode: { type: String, required: true, uppercase: true, trim: true },
    machineName: { type: String, required: true, trim: true },
    processArea: { type: String, required: true, trim: true },
    capacityUnitsPerDay: { type: Number, required: true },
    currentStatus: {
      type: String,
      enum: ["available", "maint", "breakdown"],
      default: "available",
      required: true,
    },
    machineType: { type: String, trim: true },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

MachineSchema.index({ tenantId: 1, machineCode: 1 }, { unique: true });

export const MachineModel: mongoose.Model<IMachine> =
  (mongoose.models.Machine as mongoose.Model<IMachine>) ||
  mongoose.model<IMachine>("Machine", MachineSchema);
