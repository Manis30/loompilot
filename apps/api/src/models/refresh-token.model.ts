import mongoose, { Schema, Document } from "mongoose";

export interface IRefreshTokenDocument extends Document {
  tenantId: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  revoked: boolean;
  ip?: string;
  userAgent?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RefreshTokenSchema = new Schema<IRefreshTokenDocument>(
  {
    tenantId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    familyId: { type: String, required: true, index: true },
    revoked: { type: Boolean, default: false, index: true },
    ip: { type: String },
    userAgent: { type: String },
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { timestamps: true }
);

export const RefreshTokenModel = mongoose.model<IRefreshTokenDocument>(
  "RefreshToken",
  RefreshTokenSchema
);

