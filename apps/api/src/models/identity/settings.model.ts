import mongoose, { Schema } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";

export interface IProcessConfig {
  area: string;
  hours: number;
  overlap: boolean;
  fallbackOut?: number;
  usualWorkers?: number;
}

export interface IRiskBuffer {
  k?: number;
  minPct?: number;
  maxPct?: number;
  windowDays?: number;
}

export interface IPriceThresholds {
  daily?: number;
  sevenday?: number;
  vol?: number;
}

export interface IMarketSourceConfig {
  name: string;
  type: "supplier_quote" | "web" | "feed";
  trust: "trusted" | "normal" | "unverified";
  active?: boolean;
  lastFetchedAt?: Date;
  lastStatus?: string;
  config?: any;
}

export interface ISettings extends BaseEntity {
  timezone: string;
  minMarginPct: number;
  defaultMarginPct: number;
  advancePct: number;
  processConfig: IProcessConfig[];
  holidays: string[];
  marketRuntime: string;
  reportCutoff: string;
  weeklyOffs: number[];
  safetyDays?: number;
  quoteValidityDays?: number;
  riskBuffer?: IRiskBuffer;
  behindThresholdPct?: number;
  maxBackdateDays?: number;
  priceThresholds?: IPriceThresholds;
  quoteReminderDays?: number[];
  paymentReminderLeadDays?: number;
  basePriceTolerancePct?: number;
  marketSources?: IMarketSourceConfig[];
}

const ProcessConfigSchema = new Schema<IProcessConfig>(
  {
    area: { type: String, required: true },
    hours: { type: Number, required: true },
    overlap: { type: Boolean, required: true },
    fallbackOut: { type: Number },
    usualWorkers: { type: Number },
  },
  { _id: false, strict: true }
);

const RiskBufferSchema = new Schema<IRiskBuffer>(
  {
    k: { type: Number },
    minPct: { type: Number },
    maxPct: { type: Number },
    windowDays: { type: Number },
  },
  { _id: false, strict: true }
);

const PriceThresholdsSchema = new Schema<IPriceThresholds>(
  {
    daily: { type: Number },
    sevenday: { type: Number },
    vol: { type: Number },
  },
  { _id: false, strict: true }
);

const MarketSourceSchema = new Schema<IMarketSourceConfig>(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ["supplier_quote", "web", "feed"], required: true },
    trust: { type: String, enum: ["trusted", "normal", "unverified"], required: true },
    active: { type: Boolean, default: true },
    lastFetchedAt: { type: Date },
    lastStatus: { type: String },
    config: { type: Schema.Types.Mixed },
  },
  { _id: false, strict: true }
);

const SettingsSchema = new Schema<ISettings>(
  {
    tenantId: { type: String, required: true, unique: true, index: true },
    timezone: { type: String, default: "Asia/Kolkata", required: true },
    minMarginPct: { type: Number, required: true },
    defaultMarginPct: { type: Number, required: true },
    advancePct: { type: Number, default: 30, required: true },
    processConfig: { type: [ProcessConfigSchema], required: true },
    holidays: { type: [String], required: true }, // 'YYYY-MM-DD'
    marketRuntime: { type: String, default: "06:00", required: true },
    reportCutoff: { type: String, default: "19:00", required: true },
    weeklyOffs: { type: [Number], default: [0], required: true },
    safetyDays: { type: Number },
    quoteValidityDays: { type: Number },
    riskBuffer: { type: RiskBufferSchema },
    behindThresholdPct: { type: Number },
    maxBackdateDays: { type: Number },
    priceThresholds: { type: PriceThresholdsSchema },
    quoteReminderDays: { type: [Number], default: [1] },
    paymentReminderLeadDays: { type: Number, default: 1 },
    basePriceTolerancePct: { type: Number },
    marketSources: { type: [MarketSourceSchema] },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

export const SettingsModel: mongoose.Model<ISettings> =
  (mongoose.models.Settings as mongoose.Model<ISettings>) ||
  mongoose.model<ISettings>("Settings", SettingsSchema, "settings");
