import { Types } from "mongoose";
import { BaseRepository } from "./base.repository.js";
import { IFileRecord, FileRecordModel } from "../models/platform/file.model.js";

export class FileRepository extends BaseRepository<IFileRecord> {
  constructor() {
    super(FileRecordModel);
  }

  async createFileRecord(tenantId: string, data: {
    ownerRealm: "user" | "client";
    ownerId: string;
    storageKey: string;
    name: string;
    mime: string;
    size: number;
  }): Promise<IFileRecord> {
    return this.create(tenantId, {
      ...data,
      ownerId: new Types.ObjectId(data.ownerId),
      version: 1,
    } as any);
  }
}
