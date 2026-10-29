import mongoose, { Schema, Document } from "mongoose";
import { CompanyProfile } from "../interfaces/settings.repository.js";

export interface ISettingsDocument extends Document {
  tenantId: string;
  companyProfile: CompanyProfile;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IHolidayDocument extends Document {
  tenantId: string;
  date: string; // YYYY-MM-DD
  name: string;
  processId?: string;
  createdAt: Date;
}

const defaultCompanyProfile: CompanyProfile = {
  name: "LoomPilot Textile Mill",
  currency: "INR",
  timezone: "Asia/Kolkata",
  workingDays: [1, 2, 3, 4, 5, 6], // Mon-Sat
  workingHoursPerDay: 8,
  cutoffTime: "18:00",
  defaultRiskBufferPct: 5.0,
  defaultWastagePct: 2.5,
  defaultPaymentTermsDays: 30,
};

const SettingsSchema = new Schema<ISettingsDocument>(
  {
    tenantId: { type: String, required: true, unique: true, index: true },
    companyProfile: {
      name: { type: String, default: defaultCompanyProfile.name },
      address: { type: String },
      gstin: { type: String },
      currency: { type: String, default: defaultCompanyProfile.currency },
      timezone: { type: String, default: defaultCompanyProfile.timezone },
      workingDays: { type: [Number], default: defaultCompanyProfile.workingDays },
      workingHoursPerDay: { type: Number, default: defaultCompanyProfile.workingHoursPerDay },
      cutoffTime: { type: String, default: defaultCompanyProfile.cutoffTime },
      defaultRiskBufferPct: { type: Number, default: defaultCompanyProfile.defaultRiskBufferPct },
      defaultWastagePct: { type: Number, default: defaultCompanyProfile.defaultWastagePct },
      defaultPaymentTermsDays: { type: Number, default: defaultCompanyProfile.defaultPaymentTermsDays },
    },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

const HolidaySchema = new Schema<IHolidayDocument>(
  {
    tenantId: { type: String, required: true, index: true },
    date: { type: String, required: true, index: true },
    name: { type: String, required: true },
    processId: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

HolidaySchema.index({ tenantId: 1, date: 1 }, { unique: true });

export const SettingsModel = mongoose.model<ISettingsDocument>("Settings", SettingsSchema);
export const HolidayModel = mongoose.model<IHolidayDocument>("Holiday", HolidaySchema);
