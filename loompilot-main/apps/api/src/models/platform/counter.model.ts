import mongoose, { Schema } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";

export interface ICounter extends BaseEntity {
  key: string;
  seq: number;
}

const CounterSchema = new Schema<ICounter>(
  {
    tenantId: { type: String, required: true, index: true },
    key: { type: String, required: true },
    seq: { type: Number, default: 0, required: true },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

CounterSchema.index({ tenantId: 1, key: 1 }, { unique: true });

export const CounterModel: mongoose.Model<ICounter> =
  (mongoose.models.Counter as mongoose.Model<ICounter>) ||
  mongoose.model<ICounter>("Counter", CounterSchema, "counters");
