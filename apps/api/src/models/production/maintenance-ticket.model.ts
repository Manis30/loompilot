import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";

export interface IMaintenanceTicket extends BaseEntity {
  machineId: Types.ObjectId;
  sourceReportId?: Types.ObjectId;
  issue: string;
  technicianName?: string;
  technicianContact?: string;
  status: "open" | "assigned" | "resolved";
  assignedAt?: Date;
  resolvedAt?: Date;
  openedBy?: Types.ObjectId;
  notes?: string;
}

const MaintenanceTicketSchema = new Schema<IMaintenanceTicket>(
  {
    tenantId: { type: String, required: true, index: true },
    machineId: { type: Schema.Types.ObjectId, ref: "Machine", required: true },
    sourceReportId: { type: Schema.Types.ObjectId, ref: "SupervisorDailyReport" },
    issue: { type: String, required: true },
    technicianName: { type: String },
    technicianContact: { type: String },
    status: {
      type: String,
      enum: ["open", "assigned", "resolved"],
      default: "open",
      required: true,
    },
    assignedAt: { type: Date },
    resolvedAt: { type: Date },
    openedBy: { type: Schema.Types.ObjectId, ref: "User" },
    notes: { type: String },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

MaintenanceTicketSchema.index({ tenantId: 1, machineId: 1, status: 1 });

export const MaintenanceTicketModel: mongoose.Model<IMaintenanceTicket> =
  (mongoose.models.MaintenanceTicket as mongoose.Model<IMaintenanceTicket>) ||
  mongoose.model<IMaintenanceTicket>("MaintenanceTicket", MaintenanceTicketSchema, "maintenanceTickets");

