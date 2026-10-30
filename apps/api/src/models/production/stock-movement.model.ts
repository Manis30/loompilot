import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";

export interface IPurchaseDecisionRef {
  orderId: Types.ObjectId;
  decisionId: string;
}

export interface IStockMovement extends BaseEntity {
  materialId: Types.ObjectId;
  type: "receipt" | "consume" | "reserve" | "release" | "adjust" | "opening";
  qty: number;
  qtyAfter: number;
  orderId?: Types.ObjectId;
  reportId?: Types.ObjectId;
  purchaseDecisionRef?: IPurchaseDecisionRef;
}

const PurchaseDecisionRefSchema = new Schema<IPurchaseDecisionRef>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    decisionId: { type: String, required: true },
  },
  { _id: false, strict: true }
);

const StockMovementSchema = new Schema<IStockMovement>(
  {
    tenantId: { type: String, required: true, index: true },
    materialId: { type: Schema.Types.ObjectId, ref: "Material", required: true },
    type: {
      type: String,
      enum: ["receipt", "consume", "reserve", "release", "adjust", "opening"],
      required: true,
    },
    qty: { type: Number, required: true },
    qtyAfter: { type: Number, required: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order" },
    reportId: { type: Schema.Types.ObjectId, ref: "SupervisorDailyReport" },
    purchaseDecisionRef: { type: PurchaseDecisionRefSchema },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

StockMovementSchema.index({ tenantId: 1, materialId: 1, createdAt: 1 });

export const StockMovementModel: mongoose.Model<IStockMovement> =
  (mongoose.models.StockMovement as mongoose.Model<IStockMovement>) ||
  mongoose.model<IStockMovement>("StockMovement", StockMovementSchema, "stockMovements");
