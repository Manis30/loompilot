import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";

export interface IClientAccount extends BaseEntity {
  clientId: Types.ObjectId;
  email: string;
  name: string;
  phone?: string;
  passwordHash?: string;
  status: "invited" | "active" | "locked";
  invitedBy: Types.ObjectId;
  invitedAt: Date;
  lockout?: {
    failedCount: number;
    lockedUntil?: Date | null;
  };
  notificationPrefs?: {
    inApp: boolean;
    email: boolean;
    wa: boolean;
    sms: boolean;
  };
}

const ClientAccountSchema = new Schema<IClientAccount>(
  {
    tenantId: { type: String, required: true, index: true },
    clientId: { type: Schema.Types.ObjectId, required: true, ref: "Client" },
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    passwordHash: { type: String },
    status: {
      type: String,
      enum: ["invited", "active", "locked"],
      default: "invited",
      required: true,
    },
    invitedBy: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    invitedAt: { type: Date, default: Date.now },
    lockout: {
      failedCount: { type: Number, default: 0 },
      lockedUntil: { type: Date, default: null },
    },
    notificationPrefs: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      wa: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
    },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

ClientAccountSchema.index({ tenantId: 1, email: 1 }, { unique: true });
ClientAccountSchema.index({ tenantId: 1, clientId: 1 });

export const ClientAccountModel: mongoose.Model<IClientAccount> =
  (mongoose.models.ClientAccount as mongoose.Model<IClientAccount>) ||
  mongoose.model<IClientAccount>("ClientAccount", ClientAccountSchema);
