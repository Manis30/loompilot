import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";
import { paiseField } from "../common/paise-schema.js";

export interface IPaymentReceipt {
  amount: number;
  method: string;
  ref?: string;
  date: string; // 'YYYY-MM-DD'
  by: Types.ObjectId;
  reversedAt?: Date;
}

export interface IPayment extends BaseEntity {
  orderId: Types.ObjectId;
  deliveryId?: Types.ObjectId;
  invoiceNo: string;
  amountPaise: number;
  dueDate: string; // 'YYYY-MM-DD'
  receipts: IPaymentReceipt[];
  receivedPaise: number;
  status: "pending" | "partial" | "received" | "overdue";
}

const PaymentSchema = new Schema<IPayment>(
  {
    tenantId: { type: String, required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, required: true, ref: "Order" },
    deliveryId: { type: Schema.Types.ObjectId, ref: "Delivery" },
    invoiceNo: { type: String, required: true, trim: true },
    amountPaise: paiseField({ required: true }),
    dueDate: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, "Must be 'YYYY-MM-DD' format"],
    },
    receipts: [
      {
        _id: false,
        amount: paiseField({ required: true }),
        method: { type: String, required: true },
        ref: { type: String },
        date: { type: String, required: true },
        by: { type: Schema.Types.ObjectId, required: true, ref: "User" },
        reversedAt: { type: Date },
      },
    ],
    receivedPaise: paiseField({ default: 0 }),
    status: {
      type: String,
      enum: ["pending", "partial", "received", "overdue"],
      default: "pending",
      required: true,
    },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

PaymentSchema.index({ tenantId: 1, orderId: 1 });
PaymentSchema.index({ tenantId: 1, status: 1 });

export const PaymentModel =
  mongoose.models.Payment || mongoose.model<IPayment>("Payment", PaymentSchema);
