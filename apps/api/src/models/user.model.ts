import mongoose, { Schema, Document } from "mongoose";
import { UserRole } from "@loompilot/shared";

export interface IUserDocument extends Document {
  tenantId: string;
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  refreshTokens: string[];
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUserDocument>(
  {
    tenantId: { type: String, required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    role: {
      type: String,
      enum: Object.values(UserRole),
      required: true,
      default: UserRole.SALES,
    },
    isActive: { type: Boolean, default: true },
    refreshTokens: [{ type: String }],
  },
  { timestamps: true }
);

UserSchema.index({ tenantId: 1, email: 1 }, { unique: true });

export const UserModel = mongoose.model<IUserDocument>("User", UserSchema);
