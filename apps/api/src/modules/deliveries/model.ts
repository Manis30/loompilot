import mongoose, { Schema, Document } from "mongoose";
import { DeliveryStatus } from "@loompilot/shared";

export interface IDelivery extends Document {
  tenantId: string;
  orderId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  deliveryNumber: string;
  deliveredQuantity: number;
  deliveryDate: string; // YYYY-MM-DD
  status: DeliveryStatus;
  isOnTime: boolean;
  invoiceNumber: string;
  totalInvoicePaise: number;
  receivedBy?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DeliverySchema = new Schema<IDelivery>(
  {
    tenantId: { type: String, required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: "ProductionOrder", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    deliveryNumber: { type: String, required: true },
    deliveredQuantity: { type: Number, required: true, min: 1 },
    deliveryDate: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(DeliveryStatus),
      default: DeliveryStatus.DELIVERED,
      required: true,
    },
    isOnTime: { type: Boolean, required: true, default: true },
    invoiceNumber: { type: String, required: true },
    totalInvoicePaise: { type: Number, required: true, min: 0 },
    receivedBy: { type: String },
    notes: { type: String },
  },
  { timestamps: true }
);

DeliverySchema.index({ tenantId: 1, deliveryNumber: 1 }, { unique: true });
DeliverySchema.index({ tenantId: 1, invoiceNumber: 1 }, { unique: true });

export const DeliveryModel = mongoose.model<IDelivery>("Delivery", DeliverySchema);

