import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";

export interface IImportError {
  row: number;
  error: string;
}

export interface IImportJob extends BaseEntity {
  type: string;
  status: "pending" | "processing" | "completed" | "failed";
  rowsOk: number;
  rowsFailed: number;
  errors?: IImportError[];
  fileId: Types.ObjectId;
  createdBy: Types.ObjectId;
}

const ImportErrorSchema = new Schema<IImportError>(
  {
    row: { type: Number, required: true },
    error: { type: String, required: true },
  },
  { _id: false, strict: true }
);

const ImportJobSchema = new Schema<IImportJob>(
  {
    tenantId: { type: String, required: true, index: true },
    type: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      required: true,
    },
    rowsOk: { type: Number, default: 0 },
    rowsFailed: { type: Number, default: 0 },
    errors: { type: [ImportErrorSchema] },
    fileId: { type: Schema.Types.ObjectId, ref: "File", required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    version: { type: Number, default: 1 },
  },
  { timestamps: true, suppressReservedKeysWarning: true }
);

ImportJobSchema.index({ tenantId: 1, createdAt: -1 });

export const ImportJobModel: mongoose.Model<IImportJob> =
  (mongoose.models.ImportJob as mongoose.Model<IImportJob>) ||
  mongoose.model<IImportJob>("ImportJob", ImportJobSchema, "importJobs");
