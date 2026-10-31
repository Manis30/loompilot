import { Types } from "mongoose";
import { BaseRepository } from "./base.repository.js";
import { IImportJob, IImportError, ImportJobModel } from "../models/platform/import-job.model.js";

export class ImportJobRepository extends BaseRepository<IImportJob> {
  constructor() {
    super(ImportJobModel);
  }

  async findCompletedJob(tenantId: string, type: string, fileId?: string): Promise<IImportJob | null> {
    const filter: Record<string, any> = { tenantId, type, status: "completed" };
    if (fileId) {
      filter.fileId = new Types.ObjectId(fileId);
    }
    return this.findOne(tenantId, filter);
  }

  async createJobRecord(
    tenantId: string,
    data: {
      type: string;
      status: "pending" | "processing" | "completed" | "failed";
      rowsOk: number;
      rowsFailed: number;
      errors?: IImportError[];
      fileId?: string;
      createdBy: string;
    }
  ): Promise<IImportJob> {
    return this.create(tenantId, {
      type: data.type,
      status: data.status,
      rowsOk: data.rowsOk,
      rowsFailed: data.rowsFailed,
      errors: data.errors,
      fileId: data.fileId ? new Types.ObjectId(data.fileId) : new Types.ObjectId(),
      createdBy: new Types.ObjectId(data.createdBy),
      version: 1,
    } as any);
  }
}
