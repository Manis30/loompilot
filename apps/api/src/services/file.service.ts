import { FileRepository } from "../repositories/file.repository.js";
import { ProductRepository } from "../repositories/product.repository.js";
import { OrdersRepository } from "../repositories/orders.repository.js";
import { IFileStorage } from "../interfaces/file-storage.interface.js";
import { LocalDiskFileStorage } from "../integrations/storage/local-disk-storage.js";
import { IFileRecord } from "../models/platform/file.model.js";
import { AuditService } from "./audit.service.js";
import { AppError } from "../errors/app-error.js";
import { ErrorCode } from "@loompilot/shared";
import { Readable } from "node:stream";

export const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/plain",
]);

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export class FileService {
  constructor(
    private readonly fileRepo = new FileRepository(),
    private readonly productRepo = new ProductRepository(),
    private readonly ordersRepo = new OrdersRepository(),
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

    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new AppError(
        ErrorCode.VALIDATION_FAILED,
        `MIME type '${file.mimetype}' is not permitted`,
        400
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new AppError(
        ErrorCode.VALIDATION_FAILED,
        `File size (${file.size} bytes) exceeds maximum allowed size of 10MB`,
        400
      );
    }

    const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");

    // 1. Save buffer through IFileStorage
    const stored = await this.fileStorage.saveFile(
      {
        buffer: file.buffer,
        originalFilename: sanitizedFilename,
        mimeType: file.mimetype,
      },
      {
        tenantId,
        ownerType: ownerRealm,
        ownerId,
        originalFilename: sanitizedFilename,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      }
    );

    // 2. Insert metadata record in DB
    const fileDoc = await this.fileRepo.createFileRecord(tenantId, {
      ownerRealm,
      ownerId,
      storageKey: stored.storageKey,
      name: sanitizedFilename,
      mime: file.mimetype,
      size: file.size,
    });

    // 3. Audit
    await this.auditService.log({
      tenantId,
      actor: { id: actor.id, type: ownerRealm, email: actor.email },
      action: "FILE_UPLOADED",
      entity: { collection: "files", id: String(fileDoc._id) },
      after: { name: sanitizedFilename, size: file.size, mime: file.mimetype },
      ip: actor.ip,
      requestId: actor.requestId,
    });

    return fileDoc;
  }

  async getFileForDownload(params: {
    tenantId: string;
    fileId: string;
    requester: {
      realm: "user" | "client";
      role?: string;
      clientId?: string;
      userId?: string;
    };
  }): Promise<{ stream: Readable; name: string; mime: string; size: number }> {
    const { tenantId, fileId, requester } = params;

    const file = await this.fileRepo.findById(tenantId, fileId);
    if (!file) {
      throw new AppError(ErrorCode.NOT_FOUND, "File not found", 404);
    }

    // Role-based access rules:
    // Admin: access to all files
    if (requester.realm === "user" && requester.role === "admin") {
      // Allowed
    } else if (requester.realm === "client") {
      // Client: own files OR images referenced by active products
      const isOwner = file.ownerRealm === "client" && String(file.ownerId) === String(requester.clientId);
      if (!isOwner) {
        const isProductImg = await this.productRepo.isProductImage(tenantId, fileId, true);
        if (!isProductImg) {
          throw new AppError(ErrorCode.FORBIDDEN, "Access denied: Client cannot view this file", 403);
        }
      }
    } else if (requester.realm === "user" && requester.role === "supervisor") {
      // Supervisor: product images OR files attached to orders assigned to them
      const isProductImg = await this.productRepo.isProductImage(tenantId, fileId, false);
      if (!isProductImg) {
        const isAssignedOrderFile = requester.userId
          ? await this.ordersRepo.hasFileForSupervisor(tenantId, fileId, requester.userId)
          : false;
        if (!isAssignedOrderFile) {
          throw new AppError(ErrorCode.FORBIDDEN, "Access denied: Supervisor cannot view this file", 403);
        }
      }
    } else {
      throw new AppError(ErrorCode.FORBIDDEN, "Access denied", 403);
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
