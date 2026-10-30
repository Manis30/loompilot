import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";

export interface IFileRecord extends BaseEntity {
  storageKey: string;
  name: string;
  mime: string;
  size: number;
  ownerRealm: "user" | "client";
  ownerId: Types.ObjectId;
  uploadedBy?: Types.ObjectId;
}

const FileSchema = new Schema<IFileRecord>(
  {
    tenantId: { type: String, required: true, index: true },
    storageKey: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    mime: { type: String, required: true },
    size: { type: Number, required: true },
    ownerRealm: {
      type: String,
      enum: ["user", "client"],
      required: true,
      default: "user",
    },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User" },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

FileSchema.index({ tenantId: 1, storageKey: 1 }, { unique: true });

export const FileModel =
  mongoose.models.File || mongoose.model<IFileRecord>("File", FileSchema);
