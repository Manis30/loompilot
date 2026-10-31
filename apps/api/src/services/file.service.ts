import { FileRepository } from "../repositories/file.repository.js";
import { IFileStorage } from "../interfaces/file-storage.interface.js";
import { LocalDiskFileStorage } from "../integrations/storage/local-disk-storage.js";
import { IFileRecord } from "../models/platform/file.model.js";
import { AuditService } from "./audit.service.js";
import { AppError } from "../errors/app-error.js";
import { ErrorCode } from "@loompilot/shared";
import { Readable } from "node:stream";

export class FileService {
  constructor(
    private readonly fileRepo = new FileRepository(),
    private readonly fileStorage: IFileStorage = new LocalDiskFileStorage(),
    private readonly auditService = new AuditService()
  ) {}

  async uploadFile(params: {
    tenantId: string;
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number };
    ownerRealm: "user" | "client";
    ownerId: string;
    actor: { id: string; email?: string; ip?: string; requestId?: string };
  }): Promise<IFileRecord> {
    const { tenantId, file, ownerRealm, ownerId, actor } = params;

    // 1. Save buffer through IFileStorage
    const stored = await this.fileStorage.saveFile(
      {
        buffer: file.buffer,
        originalFilename: file.originalname,
        mimeType: file.mimetype,
      },
      {
        tenantId,
        ownerType: ownerRealm,
        ownerId,
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      }
    );

    // 2. Insert metadata record in DB
    const fileDoc = await this.fileRepo.createFileRecord(tenantId, {
      ownerRealm,
      ownerId,
      storageKey: stored.storageKey,
      name: file.originalname,
      mime: file.mimetype,
      size: file.size,
    });

    // 3. Audit
    await this.auditService.log({
      tenantId,
      actor: { id: actor.id, type: ownerRealm, email: actor.email },
      action: "FILE_UPLOADED",
      entity: { collection: "files", id: String(fileDoc._id) },
      after: { name: file.originalname, size: file.size, mime: file.mimetype },
      ip: actor.ip,
      requestId: actor.requestId,
    });

    return fileDoc;
  }

  async getFileForDownload(params: {
    tenantId: string;
    fileId: string;
    requester: { realm: "user" | "client"; clientId?: string; userId?: string };
  }): Promise<{ stream: Readable; name: string; mime: string; size: number }> {
    const { tenantId, fileId, requester } = params;

    const file = await this.fileRepo.findById(tenantId, fileId);
    if (!file) {
      throw new AppError(ErrorCode.NOT_FOUND, "File not found", 404);
    }

    // Ownership check: Clients can ONLY access their own files
    if (requester.realm === "client") {
      if (file.ownerRealm !== "client" || String(file.ownerId) !== String(requester.clientId)) {
        throw new AppError(ErrorCode.FORBIDDEN, "Access denied: Client cannot view this file", 403);
      }
    }

    const { stream, mimeType, sizeBytes } = await this.fileStorage.getFileStream(file.storageKey);

    return {
      stream,
      name: file.name,
      mime: file.mime || mimeType,
      size: file.size || sizeBytes,
    };
  }
}
