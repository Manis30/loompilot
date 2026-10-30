import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";

export interface IMachineStatusLog extends BaseEntity {
  machineId: Types.ObjectId;
  supervisorId?: Types.ObjectId;
  reportId?: Types.ObjectId;
  statusDate: string; // 'YYYY-MM-DD'
  status: "available" | "maint" | "breakdown";
  availableHours: number;
  availableCapacityUnitsPerDay: number;
  remarks?: string;
}

const MachineStatusLogSchema = new Schema<IMachineStatusLog>(
  {
    tenantId: { type: String, required: true, index: true },
    machineId: { type: Schema.Types.ObjectId, required: true, ref: "Machine" },
    supervisorId: { type: Schema.Types.ObjectId, ref: "User" },
    reportId: { type: Schema.Types.ObjectId, ref: "SupervisorDailyReport" },
    statusDate: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, "Must be 'YYYY-MM-DD' format"],
    },
    status: {
      type: String,
      enum: ["available", "maint", "breakdown"],
      required: true,
    },
    availableHours: { type: Number, required: true },
    availableCapacityUnitsPerDay: { type: Number, required: true },
    remarks: { type: String },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

MachineStatusLogSchema.index(
  { tenantId: 1, machineId: 1, statusDate: 1 },
  { unique: true }
);

export const MachineStatusLogModel =
  mongoose.models.MachineStatusLog ||
  mongoose.model<IMachineStatusLog>("MachineStatusLog", MachineStatusLogSchema);
