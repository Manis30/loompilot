import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";
import { paiseField } from "../common/paise-schema.js";

export interface IPriceHistory extends BaseEntity {
  materialId: Types.ObjectId;
  date: string; // 'YYYY-MM-DD'
  consolidatedPricePaise: number;
  method: "baseline" | "median";
  sourceCount: number;
  change1dPct: number;
  change7dPct: number;
  volatility: number;
  hasUnverifiedMove: boolean;
}

const PriceHistorySchema = new Schema<IPriceHistory>(
  {
    tenantId: { type: String, required: true, index: true },
    materialId: { type: Schema.Types.ObjectId, required: true, ref: "Material" },
    date: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, "Must be 'YYYY-MM-DD' format"],
    },
    consolidatedPricePaise: paiseField({ required: true }),
    method: {
      type: String,
      enum: ["baseline", "median"],
      default: "baseline",
      required: true,
    },
    sourceCount: { type: Number, default: 1 },
    change1dPct: { type: Number, default: 0 },
    change7dPct: { type: Number, default: 0 },
    volatility: { type: Number, default: 0 },
    hasUnverifiedMove: { type: Boolean, default: false },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

PriceHistorySchema.index({ tenantId: 1, materialId: 1, date: 1 }, { unique: true });

export const PriceHistoryModel =
  mongoose.models.PriceHistory || mongoose.model<IPriceHistory>("PriceHistory", PriceHistorySchema);
