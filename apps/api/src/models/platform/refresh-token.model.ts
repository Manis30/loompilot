import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";

export interface IRefreshToken extends BaseEntity {
  realm: "user" | "client";
  subjectId: Types.ObjectId;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date;
  replacedByTokenHash?: string;
}

const RefreshTokenSchema = new Schema<IRefreshToken>(
  {
    tenantId: { type: String, required: true, index: true },
    realm: {
      type: String,
      enum: ["user", "client"],
      required: true,
    },
    subjectId: { type: Schema.Types.ObjectId, required: true },
    familyId: { type: String, required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    replacedByTokenHash: { type: String },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

RefreshTokenSchema.index({ tokenHash: 1 }, { unique: true });
RefreshTokenSchema.index({ familyId: 1 });
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL on expiresAt

export const RefreshTokenModel: mongoose.Model<IRefreshToken> =
  (mongoose.models.RefreshToken as mongoose.Model<IRefreshToken>) ||
  mongoose.model<IRefreshToken>("RefreshToken", RefreshTokenSchema);
