import mongoose, { Schema } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";

export interface ICounter extends BaseEntity {
  orderNumber?: number;
  quotationNumber?: number;
}

const CounterSchema = new Schema<ICounter>(
  {
    tenantId: { type: String, required: true, unique: true, index: true },
    orderNumber: { type: Number, default: 0 },
    quotationNumber: { type: Number, default: 0 },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

export const CounterModel =
  mongoose.models.Counter || mongoose.model<ICounter>("Counter", CounterSchema);
