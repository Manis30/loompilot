import mongoose, { Schema } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";

export interface IUser extends BaseEntity {
  role: "admin" | "supervisor";
  name: string;
  email: string;
  phone?: string;
  passwordHash: string;
  status: "active" | "locked";
  processAreas: string[];
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

const UserSchema = new Schema<IUser>(
  {
    tenantId: { type: String, required: true, index: true },
    role: {
      type: String,
      enum: ["admin", "supervisor"],
      required: true,
    },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    passwordHash: { type: String, required: true },
    status: {
      type: String,
      enum: ["active", "locked"],
      default: "active",
      required: true,
    },
    processAreas: [{ type: String, trim: true }],
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

UserSchema.index({ tenantId: 1, email: 1 }, { unique: true });

export const UserModel: mongoose.Model<IUser> =
  (mongoose.models.User as mongoose.Model<IUser>) ||
  mongoose.model<IUser>("User", UserSchema);
