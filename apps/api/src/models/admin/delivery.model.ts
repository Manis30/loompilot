import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";
import { paiseField } from "../common/paise-schema.js";

export interface IDelivery extends BaseEntity {
  orderId: Types.ObjectId;
  deliveryDate: string; // 'YYYY-MM-DD'
  qty: number;
  invoiceNo?: string;
  invoiceAmountPaise?: number;
  onTime: boolean;
  delayDays: number;
  recordedBy: Types.ObjectId;
}

const DeliverySchema = new Schema<IDelivery>(
  {
    tenantId: { type: String, required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, required: true, ref: "Order" },
    deliveryDate: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, "Must be 'YYYY-MM-DD' format"],
    },
    qty: { type: Number, required: true },
    invoiceNo: { type: String },
    invoiceAmountPaise: paiseField(),
    onTime: { type: Boolean, default: true, required: true },
    delayDays: { type: Number, default: 0, required: true },
    recordedBy: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

DeliverySchema.index({ tenantId: 1, orderId: 1 });

export const DeliveryModel =
  mongoose.models.Delivery || mongoose.model<IDelivery>("Delivery", DeliverySchema);
