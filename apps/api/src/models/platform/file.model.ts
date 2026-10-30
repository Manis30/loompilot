import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";

export interface IFileRecord extends BaseEntity {
  ownerRealm: "user" | "client";
  ownerId: Types.ObjectId;
  storageKey: string;
  name: string;
  mime: string;
  size: number;
}

const FileSchema = new Schema<IFileRecord>(
  {
    tenantId: { type: String, required: true, index: true },
    ownerRealm: {
      type: String,
      enum: ["user", "client"],
      required: true,
    },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    storageKey: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    mime: { type: String, required: true },
    size: { type: Number, required: true },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

FileSchema.index({ tenantId: 1, ownerRealm: 1, ownerId: 1 });

export const FileRecordModel: mongoose.Model<IFileRecord> =
  (mongoose.models.File as mongoose.Model<IFileRecord>) ||
  mongoose.model<IFileRecord>("File", FileSchema);
