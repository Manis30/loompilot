import mongoose, { Schema } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";

export interface IMarketSource extends BaseEntity {
  name: string;
  type: "supplier_quote" | "web" | "feed";
  trust: "trusted" | "normal" | "unverified";
  active: boolean;
  lastFetchedAt?: Date;
  lastStatus?: "ok" | "failed";
  config: Record<string, any>;
}

const MarketSourceSchema = new Schema<IMarketSource>(
  {
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["supplier_quote", "web", "feed"],
      required: true,
    },
    trust: {
      type: String,
      enum: ["trusted", "normal", "unverified"],
      default: "normal",
      required: true,
    },
    active: { type: Boolean, default: true },
    lastFetchedAt: { type: Date },
    lastStatus: {
      type: String,
      enum: ["ok", "failed"],
    },
    config: { type: Schema.Types.Mixed, default: {} },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

MarketSourceSchema.index({ tenantId: 1, name: 1 }, { unique: true });

export const MarketSourceModel =
  mongoose.models.MarketSource || mongoose.model<IMarketSource>("MarketSource", MarketSourceSchema);
