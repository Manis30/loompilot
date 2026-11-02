import mongoose, { Schema } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";

export interface IUserNotificationPrefs {
  inApp: boolean;
  email: boolean;
  wa: boolean;
  sms: boolean;
}

export interface IUserLockout {
  failedCount: number;
  lockedUntil?: Date | null;
}

export interface IUser extends BaseEntity {
  role: "admin" | "supervisor";
  name: string;
  email: string;
  phone?: string;
  passwordHash: string;
  processAreas: string[];
  status: "active" | "locked";
  notificationPrefs?: IUserNotificationPrefs;
  lockout?: IUserLockout;
}

export function validateUserProcessAreas(
  userAreas: string[],
  configAreas: string[]
): boolean {
  if (!userAreas || userAreas.length === 0) return true;
  const validSet = new Set(configAreas);
  return userAreas.every((area) => validSet.has(area));
}

const UserNotificationPrefsSchema = new Schema<IUserNotificationPrefs>(
  {
    inApp: { type: Boolean, default: true },
    email: { type: Boolean, default: true },
    wa: { type: Boolean, default: false },
    sms: { type: Boolean, default: false },
  },
  { _id: false, strict: true }
);

const UserLockoutSchema = new Schema<IUserLockout>(
  {
    failedCount: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
  },
  { _id: false, strict: true }
);

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
    passwordHash: { type: String, required: true, select: false },
    processAreas: { type: [String], required: true },
    status: {
      type: String,
      enum: ["active", "locked"],
      default: "active",
      required: true,
    },
    notificationPrefs: { type: UserNotificationPrefsSchema },
    lockout: { type: UserLockoutSchema },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

UserSchema.index({ tenantId: 1, email: 1 }, { unique: true });

export const UserModel: mongoose.Model<IUser> =
  (mongoose.models.User as mongoose.Model<IUser>) ||
  mongoose.model<IUser>("User", UserSchema, "users");
