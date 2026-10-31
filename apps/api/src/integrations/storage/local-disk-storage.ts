import fs from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Readable } from "node:stream";
import {
  IFileStorage,
  FileMetadata,
  StoredFileResult,
} from "../../interfaces/file-storage.interface.js";
import { AppError } from "../../errors/app-error.js";
import { ErrorCode } from "@loompilot/shared";

export class LocalDiskFileStorage implements IFileStorage {
  private readonly basePath: string;

  constructor(basePath: string = "./uploads") {
    this.basePath = path.resolve(basePath);
  }

  async saveFile(
    file: { buffer: Buffer; originalFilename: string; mimeType: string },
    metadata: FileMetadata
  ): Promise<StoredFileResult> {
    const safeExt = path.extname(file.originalFilename) || "";
    const uniqueId = crypto.randomUUID();
    const subDir = path.join(this.basePath, metadata.tenantId);
    await fs.mkdir(subDir, { recursive: true });

    const filename = `${uniqueId}${safeExt}`;
    const filePath = path.join(subDir, filename);
    const metaPath = `${filePath}.meta.json`;

    await fs.writeFile(filePath, file.buffer);
    const enrichedMetadata: FileMetadata = {
      ...metadata,
      sizeBytes: file.buffer.length,
      mimeType: file.mimeType,
      originalFilename: file.originalFilename,
    };
    await fs.writeFile(metaPath, JSON.stringify(enrichedMetadata, null, 2), "utf-8");

    const storageKey = path.relative(this.basePath, filePath).replace(/\\/g, "/");

    return {
      storageKey,
      originalFilename: file.originalFilename,
      mimeType: file.mimeType,
      sizeBytes: file.buffer.length,
      metadata: enrichedMetadata,
    };
  }

  async getFileStream(
    storageKey: string
  ): Promise<{ stream: Readable; mimeType: string; sizeBytes: number }> {
    // Prevent directory traversal attacks
    const normalized = path.normalize(storageKey).replace(/^(\.\.(\/|\\|$))+/, "");
    const fullPath = path.join(this.basePath, normalized);
    const metaPath = `${fullPath}.meta.json`;

    if (!existsSync(fullPath)) {
      throw new AppError(ErrorCode.NOT_FOUND, `Stored file not found: ${storageKey}`, 404);
    }

    let mimeType = "application/octet-stream";
    let sizeBytes = 0;

    if (existsSync(metaPath)) {
      try {
        const metaRaw = await fs.readFile(metaPath, "utf-8");
        const meta = JSON.parse(metaRaw);
        mimeType = meta.mimeType || mimeType;
        sizeBytes = meta.sizeBytes || 0;
      } catch {
        // Fallback to stat
      }
    }

    if (!sizeBytes) {
      const stat = await fs.stat(fullPath);
      sizeBytes = stat.size;
    }

    const stream = createReadStream(fullPath);
    return { stream, mimeType, sizeBytes };
  }

  async deleteFile(storageKey: string): Promise<void> {
    const normalized = path.normalize(storageKey).replace(/^(\.\.(\/|\\|$))+/, "");
    const fullPath = path.join(this.basePath, normalized);
    const metaPath = `${fullPath}.meta.json`;

    try {
      if (existsSync(fullPath)) {
        await fs.unlink(fullPath);
      }
      if (existsSync(metaPath)) {
        await fs.unlink(metaPath);
      }
    } catch {
      // Ignored if already removed
    }
  }
}

