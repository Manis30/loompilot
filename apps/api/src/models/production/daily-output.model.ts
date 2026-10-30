import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";

export interface IDailyOutput extends BaseEntity {
  orderId: Types.ObjectId;
  reportId: Types.ObjectId;
  supervisorId: Types.ObjectId;
  outputDate: string; // 'YYYY-MM-DD'
  processStage: string;
  producedQty: number;
  defectiveQty: number;
  cumulativeQty: number;
}

const DailyOutputSchema = new Schema<IDailyOutput>(
  {
    tenantId: { type: String, required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, required: true, ref: "Order" },
    reportId: { type: Schema.Types.ObjectId, required: true, ref: "SupervisorDailyReport" },
    supervisorId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    outputDate: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, "Must be 'YYYY-MM-DD' format"],
    },
    processStage: { type: String, required: true },
    producedQty: { type: Number, required: true },
    defectiveQty: { type: Number, default: 0 },
    cumulativeQty: { type: Number, default: 0 },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

DailyOutputSchema.index(
  { tenantId: 1, orderId: 1, processStage: 1, outputDate: 1, supervisorId: 1 },
  { unique: true }
);
DailyOutputSchema.index({ tenantId: 1, reportId: 1 });

export const DailyOutputModel =
  mongoose.models.DailyOutput || mongoose.model<IDailyOutput>("DailyOutput", DailyOutputSchema);
