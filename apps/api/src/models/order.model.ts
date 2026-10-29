import mongoose, { Schema, Document } from "mongoose";
import { OrderStatus, ProcessName } from "@loompilot/shared";

export interface IProcessPlanStep {
  processId: mongoose.Types.ObjectId;
  processName: ProcessName;
  sequence: number;
  targetQty: number;
  dailyTarget: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  completedQty: number;
}

export interface IProductionOrder extends Document {
  tenantId: string;
  quotationId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  orderNumber: string;
  productName: string;
  totalQuantity: number;
  unit: string;
  status: OrderStatus;
  startDate: string;
  targetDeliveryDate: string;
  actualDeliveryDate?: string;
  plan: IProcessPlanStep[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const ProcessPlanStepSchema = new Schema<IProcessPlanStep>(
  {
    processId: { type: Schema.Types.ObjectId, ref: "Process", required: true },
    processName: { type: String, enum: Object.values(ProcessName), required: true },
    sequence: { type: Number, required: true },
    targetQty: { type: Number, required: true, min: 0 },
    dailyTarget: { type: Number, required: true, min: 0 },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    completedQty: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const ProductionOrderSchema = new Schema<IProductionOrder>(
  {
    tenantId: { type: String, required: true, index: true },
    quotationId: { type: Schema.Types.ObjectId, ref: "Quotation", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    orderNumber: { type: String, required: true },
    productName: { type: String, required: true },
    totalQuantity: { type: Number, required: true, min: 1 },
    unit: { type: String, required: true, default: "meters" },
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      default: OrderStatus.PLANNED,
      required: true,
      index: true,
    },
    startDate: { type: String, required: true },
    targetDeliveryDate: { type: String, required: true },
    actualDeliveryDate: { type: String },
    plan: [ProcessPlanStepSchema],
    version: { type: Number, required: true, default: 1 },
  },
  { timestamps: true }
);

ProductionOrderSchema.index({ tenantId: 1, orderNumber: 1 }, { unique: true });

export const ProductionOrderModel = mongoose.model<IProductionOrder>(
  "ProductionOrder",
  ProductionOrderSchema
);

