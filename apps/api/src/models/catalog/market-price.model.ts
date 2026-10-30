import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";
import { paiseField } from "../common/paise-schema.js";

export interface IMarketPriceObservation {
  source: string;
  sourceType: "supplier_quote" | "web" | "feed";
  unitPricePaise: number;
  trust: "trusted" | "normal" | "unverified";
  verificationStatus: "verified" | "pending" | "rejected";
}

export interface IMarketPriceAlert {
  thresholdBreached: string;
  status: "open" | "ack" | "resolved" | "dismissed";
  acknowledgedBy?: Types.ObjectId;
  affectedOrderIds?: Types.ObjectId[];
  agentRunId?: Types.ObjectId;
}

export interface IMarketPrice extends BaseEntity {
  materialId: Types.ObjectId;
  date: string; // YYYY-MM-DD
  consolidatedPricePaise: number;
  change1dPct?: number;
  change7dPct?: number;
  volatility?: number;
  method?: "baseline" | "median";
  sourceCount?: number;
  hasUnverifiedMove?: boolean;
  observations?: IMarketPriceObservation[];
  alert?: IMarketPriceAlert;
}

const ObservationSchema = new Schema<IMarketPriceObservation>(
  {
    source: { type: String, required: true },
    sourceType: {
      type: String,
      enum: ["supplier_quote", "web", "feed"],
      required: true,
    },
    unitPricePaise: paiseField({ required: true }),
    trust: {
      type: String,
      enum: ["trusted", "normal", "unverified"],
      required: true,
    },
    verificationStatus: {
      type: String,
      enum: ["verified", "pending", "rejected"],
      default: "pending",
      required: true,
    },
  },
  { _id: false, strict: true }
);

const AlertSchema = new Schema<IMarketPriceAlert>(
  {
    thresholdBreached: { type: String, required: true },
    status: {
      type: String,
      enum: ["open", "ack", "resolved", "dismissed"],
      default: "open",
      required: true,
    },
    acknowledgedBy: { type: Schema.Types.ObjectId, ref: "User" },
    affectedOrderIds: [{ type: Schema.Types.ObjectId, ref: "Order" }],
    agentRunId: { type: Schema.Types.ObjectId, ref: "AgentRun" },
  },
  { _id: false, strict: true }
);

const MarketPriceSchema = new Schema<IMarketPrice>(
  {
    tenantId: { type: String, required: true, index: true },
    materialId: { type: Schema.Types.ObjectId, ref: "Material", required: true },
    date: { type: String, required: true },
    consolidatedPricePaise: paiseField({ required: true }),
    change1dPct: { type: Number },
    change7dPct: { type: Number },
    volatility: { type: Number },
    method: { type: String, enum: ["baseline", "median"] },
    sourceCount: { type: Number },
    hasUnverifiedMove: { type: Boolean },
    observations: { type: [ObservationSchema] },
    alert: { type: AlertSchema },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

MarketPriceSchema.index({ tenantId: 1, materialId: 1, date: 1 }, { unique: true });

export const MarketPriceModel: mongoose.Model<IMarketPrice> =
  (mongoose.models.MarketPrice as mongoose.Model<IMarketPrice>) ||
  mongoose.model<IMarketPrice>("MarketPrice", MarketPriceSchema);
