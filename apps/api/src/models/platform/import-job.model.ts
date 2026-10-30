import mongoose, { Schema, Types } from "mongoose";
import { BaseEntity } from "../../interfaces/base-repository.interface.js";

export interface IImportJob extends BaseEntity {
  jobType: string;
  status: "pending" | "processing" | "completed" | "failed";
  rowsOk: number;
  rowsFailed: number;
  errorRows: Array<{
    row: number;
    error: string;
  }>;
  uploadedBy: Types.ObjectId;
  fileId?: Types.ObjectId;
}

const ImportJobSchema = new Schema<IImportJob>(
  {
    tenantId: { type: String, required: true, index: true },
    jobType: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      required: true,
    },
    rowsOk: { type: Number, default: 0 },
    rowsFailed: { type: Number, default: 0 },
    errorRows: [
      {
        _id: false,
        row: { type: Number, required: true },
        error: { type: String, required: true },
      },
    ],
    uploadedBy: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    fileId: { type: Schema.Types.ObjectId, ref: "File" },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

ImportJobSchema.index({ tenantId: 1, status: 1 });

export const ImportJobModel =
  mongoose.models.ImportJob || mongoose.model<IImportJob>("ImportJob", ImportJobSchema);
