import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";

export interface ISupervisorAssignment {
  supervisorId: Types.ObjectId;
  processes: string[];
}

export interface IOrderAssignmentPlanSourceStep {
  stage: string;
  start: string;
  end: string;
  dailyTarget: number;
}

export interface IOrderAssignment extends BaseEntity {
  orderId: Types.ObjectId;
  supervisors: ISupervisorAssignment[];
  planSource: IOrderAssignmentPlanSourceStep[];
  assignedBy: Types.ObjectId;
  acknowledgedAt?: Date;
  status: "assigned" | "started" | "done";
}

const OrderAssignmentSchema = new Schema<IOrderAssignment>(
  {
    tenantId: { type: String, required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, required: true, ref: "Order" },
    supervisors: [
      {
        _id: false,
        supervisorId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
        processes: [{ type: String, required: true }],
      },
    ],
    planSource: [
      {
        _id: false,
        stage: { type: String, required: true },
        start: { type: String, required: true },
        end: { type: String, required: true },
        dailyTarget: { type: Number, required: true },
      },
    ],
    assignedBy: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    acknowledgedAt: { type: Date },
    status: {
      type: String,
      enum: ["assigned", "started", "done"],
      default: "assigned",
      required: true,
    },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

OrderAssignmentSchema.index({ tenantId: 1, orderId: 1 }, { unique: true });

export const OrderAssignmentModel =
  mongoose.models.OrderAssignment ||
  mongoose.model<IOrderAssignment>("OrderAssignment", OrderAssignmentSchema);
