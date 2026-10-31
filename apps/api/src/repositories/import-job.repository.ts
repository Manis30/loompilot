import { Types } from "mongoose";
import { BaseRepository } from "./base.repository.js";
import { IImportJob, IImportError, ImportJobModel } from "../models/platform/import-job.model.js";

export class ImportJobRepository extends BaseRepository<IImportJob> {
  constructor() {
    super(ImportJobModel);
  }

  async findCompletedJob(tenantId: string, type: string, fileId?: string, fileHash?: string): Promise<IImportJob | null> {
    const filter: Record<string, any> = { tenantId, type, status: "completed" };
    if (fileId) {
      filter.fileId = new Types.ObjectId(fileId);
    }
    if (fileHash) {
      filter.fileHash = fileHash;
    }
    return this.findOne(tenantId, filter);
  }

  async findByHash(tenantId: string, fileHash: string): Promise<IImportJob | null> {
    return this.findOne(tenantId, { tenantId, fileHash });
  }

  async createJobRecord(
    tenantId: string,
    data: {
      type: string;
      status: "pending" | "processing" | "completed" | "failed";
      rowsOk: number;
      rowsFailed: number;
      errors?: IImportError[];
      fileHash?: string;
      validRows?: any[];
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
      fileHash: data.fileHash,
      validRows: data.validRows,
      fileId: data.fileId ? new Types.ObjectId(data.fileId) : undefined,
      createdBy: new Types.ObjectId(data.createdBy),
      version: 1,
    } as any);
  }
}
