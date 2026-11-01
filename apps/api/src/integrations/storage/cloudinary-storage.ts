import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import { Readable } from "node:stream";
import path from "node:path";
import crypto from "node:crypto";
import {
  IFileStorage,
  FileMetadata,
  StoredFileResult,
} from "../../interfaces/file-storage.interface.js";
import { AppError } from "../../errors/app-error.js";
import { ErrorCode } from "@loompilot/shared";
import { logger } from "../../utils/logger.js";

export class CloudinaryStorage implements IFileStorage {
  private readonly cloudName: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;

  constructor(options: { cloudName: string; apiKey: string; apiSecret: string }) {
    this.cloudName = options.cloudName;
    this.apiKey = options.apiKey;
    this.apiSecret = options.apiSecret;

    cloudinary.config({
      cloud_name: this.cloudName,
      api_key: this.apiKey,
      api_secret: this.apiSecret,
      secure: true,
    });
  }

  async saveFile(
    file: { buffer: Buffer; originalFilename: string; mimeType: string },
    metadata: FileMetadata
  ): Promise<StoredFileResult> {
    if (!this.cloudName || !this.apiKey || !this.apiSecret) {
      throw new AppError(ErrorCode.SERVICE_UNAVAILABLE, "Cloudinary credentials not configured", 500);
    }

    const uniqueId = crypto.randomUUID();
    const folder = `loompilot/${metadata.tenantId}/${metadata.ownerType}`;

    return new Promise<StoredFileResult>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: `${path.parse(file.originalFilename).name}_${uniqueId}`,
          resource_type: "auto",
        },
        (error, result: UploadApiResponse | undefined) => {
          if (error || !result) {
            logger.error({ err: error }, "Cloudinary upload error");
            return reject(
              new AppError(ErrorCode.SERVICE_UNAVAILABLE, error?.message || "Failed to upload to Cloudinary", 502)
            );
          }

          const enrichedMetadata: FileMetadata = {
            ...metadata,
            sizeBytes: result.bytes || file.buffer.length,
            mimeType: file.mimeType,
            originalFilename: file.originalFilename,
          };

          resolve({
            storageKey: result.public_id,
            originalFilename: file.originalFilename,
            mimeType: file.mimeType,
            sizeBytes: result.bytes || file.buffer.length,
            metadata: enrichedMetadata,
          });
        }
      );

      uploadStream.end(file.buffer);
    });
  }

  async getFileStream(
    storageKey: string
  ): Promise<{ stream: Readable; mimeType: string; sizeBytes: number }> {
    const url = cloudinary.url(storageKey, {
      secure: true,
      resource_type: "auto",
    });

    try {
      const response = await fetch(url);
      if (!response.ok || !response.body) {
        throw new AppError(ErrorCode.NOT_FOUND, "File not found in storage", 404);
      }

      const stream = Readable.fromWeb(response.body as any);
      const mimeType = response.headers.get("content-type") || "application/octet-stream";
      const sizeBytes = parseInt(response.headers.get("content-length") || "0", 10);

      return { stream, mimeType, sizeBytes };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      logger.error({ err: err.message, storageKey }, "Cloudinary fetch file stream error");
      throw new AppError(ErrorCode.SERVICE_UNAVAILABLE, "Failed to retrieve file from storage", 502);
    }
  }

  async deleteFile(storageKey: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(storageKey, { resource_type: "auto" });
    } catch (err: any) {
      logger.warn({ err: err.message, storageKey }, "Cloudinary file deletion warning");
    }
  }
}

