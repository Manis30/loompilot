import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";
import { paiseField } from "../common/paise-schema.js";

export interface ISupplierOrderInfo {
  orderNo?: string;
  status?: string;
  recvQty?: number;
  recvAt?: Date;
}

export interface IPurchaseDecision extends BaseEntity {
  orderId: Types.ObjectId;
  feasibilityId: Types.ObjectId;
  optionId: string;
  materialId: Types.ObjectId;
  supplierId: Types.ObjectId;
  qty: number;
  ratePaise: number;
  expectedArrivalDate: string; // 'YYYY-MM-DD'
  decidedBy: Types.ObjectId;
  supplierOrder?: ISupplierOrderInfo;
}

const PurchaseDecisionSchema = new Schema<IPurchaseDecision>(
  {
    tenantId: { type: String, required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, required: true, ref: "Order" },
    feasibilityId: { type: Schema.Types.ObjectId, required: true, ref: "FeasibilityReport" },
    optionId: { type: String, required: true },
    materialId: { type: Schema.Types.ObjectId, required: true, ref: "Material" },
    supplierId: { type: Schema.Types.ObjectId, required: true, ref: "Supplier" },
    qty: { type: Number, required: true },
    ratePaise: paiseField({ required: true }),
    expectedArrivalDate: { type: String, required: true },
    decidedBy: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    supplierOrder: {
      orderNo: { type: String },
      status: { type: String },
      recvQty: { type: Number },
      recvAt: { type: Date },
    },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

PurchaseDecisionSchema.index({ tenantId: 1, orderId: 1 });

export const PurchaseDecisionModel =
  mongoose.models.PurchaseDecision ||
  mongoose.model<IPurchaseDecision>("PurchaseDecision", PurchaseDecisionSchema);
