import mongoose, { Schema } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";

export interface ISettings extends BaseEntity {
  timezone: string;
  minMarginPct: number;
  defaultMarginPct: number;
  riskBuffer: {
    k: number;
    minPct: number;
    maxPct: number;
    windowDays: number;
  };
  behindThresholdPct: number;
  maxBackdateDays: number;
  weeklyOffs: number[];
  safetyDays: number;
  quoteValidityDays: number;
  priceThresholds: {
    daily: number;
    sevenday: number;
    vol: number;
  };
  processConfig: Array<{
    area: string;
    hours: number;
    overlap: number;
    fallbackOut: number;
  }>;
  holidays: Array<{
    date: string;
    name: string;
  }>;
  marketRuntime: string;
  reportCutoff: string;
}

const SettingsSchema = new Schema<ISettings>(
  {
    tenantId: { type: String, required: true, unique: true, index: true },
    timezone: { type: String, default: "Asia/Kolkata" },
    minMarginPct: { type: Number, default: 12 },
    defaultMarginPct: { type: Number, default: 18 },
    riskBuffer: {
      k: { type: Number, default: 1.5 },
      minPct: { type: Number, default: 3 },
      maxPct: { type: Number, default: 10 },
      windowDays: { type: Number, default: 30 },
    },
    behindThresholdPct: { type: Number, default: 10 },
    maxBackdateDays: { type: Number, default: 3 },
    weeklyOffs: { type: [Number], default: [0] }, // 0 = Sunday, 1 = Monday, etc.
    safetyDays: { type: Number, default: 2 },
    quoteValidityDays: { type: Number, default: 7 },
    priceThresholds: {
      daily: { type: Number, default: 5 },
      sevenday: { type: Number, default: 10 },
      vol: { type: Number, default: 15 },
    },
    processConfig: [
      {
        _id: false,
        area: { type: String, required: true },
        hours: { type: Number, required: true },
        overlap: { type: Number, default: 0 },
        fallbackOut: { type: Number, default: 0 },
      },
    ],
    holidays: [
      {
        _id: false,
        date: { type: String, required: true }, // 'YYYY-MM-DD'
        name: { type: String, required: true },
      },
    ],
    marketRuntime: { type: String, default: "06:00" },
    reportCutoff: { type: String, default: "18:00" },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

export const SettingsModel: mongoose.Model<ISettings> =
  (mongoose.models.Settings as mongoose.Model<ISettings>) ||
  mongoose.model<ISettings>("Settings", SettingsSchema);
