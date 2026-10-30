import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";

export interface IClientNotificationPrefs {
  inApp: boolean;
  email: boolean;
  wa: boolean;
  sms: boolean;
}

export interface IClientLockout {
  failedCount: number;
  lockedUntil?: Date | null;
}

export interface IClientPortalAccess {
  email?: string;
  passwordHash?: string;
  status: "invited" | "active" | "locked";
  invitedBy?: Types.ObjectId;
  invitedAt?: Date;
  acceptedAt?: Date;
  lockout?: IClientLockout;
  notificationPrefs?: IClientNotificationPrefs;
}

export interface IClient extends BaseEntity {
  clientName: string;
  contactPerson?: string;
  email: string;
  phone?: string;
  city?: string;
  address?: string;
  customerType?: string;
  paymentTermsDays?: number;
  country?: string;
  status: "active" | "inactive";
  portalAccess?: IClientPortalAccess;
}

const ClientNotificationPrefsSchema = new Schema<IClientNotificationPrefs>(
  {
    inApp: { type: Boolean, default: true },
    email: { type: Boolean, default: true },
    wa: { type: Boolean, default: false },
    sms: { type: Boolean, default: false },
  },
  { _id: false, strict: true }
);

const ClientLockoutSchema = new Schema<IClientLockout>(
  {
    failedCount: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
  },
  { _id: false, strict: true }
);

const PortalAccessSchema = new Schema<IClientPortalAccess>(
  {
    email: { type: String, lowercase: true, trim: true },
    passwordHash: { type: String, select: false },
    status: {
      type: String,
      enum: ["invited", "active", "locked"],
      default: "invited",
    },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User" },
    invitedAt: { type: Date },
    acceptedAt: { type: Date },
    lockout: { type: ClientLockoutSchema },
    notificationPrefs: { type: ClientNotificationPrefsSchema },
  },
  { _id: false, strict: true }
);

const ClientSchema = new Schema<IClient>(
  {
    tenantId: { type: String, required: true, index: true },
    clientName: { type: String, required: true, trim: true },
    contactPerson: { type: String, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    city: { type: String, trim: true },
    address: { type: String },
    customerType: { type: String },
    paymentTermsDays: { type: Number },
    country: { type: String },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      required: true,
    },
    portalAccess: { type: PortalAccessSchema },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

ClientSchema.index(
  { tenantId: 1, "portalAccess.email": 1 },
  {
    unique: true,
    partialFilterExpression: { "portalAccess.email": { $type: "string" } },
  }
);
ClientSchema.index({ tenantId: 1, clientName: 1 });

export const ClientModel: mongoose.Model<IClient> =
  (mongoose.models.Client as mongoose.Model<IClient>) ||
  mongoose.model<IClient>("Client", ClientSchema);
