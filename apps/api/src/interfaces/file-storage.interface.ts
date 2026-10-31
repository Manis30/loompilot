import { Readable } from "node:stream";

export interface FileMetadata {
  tenantId: string;
  ownerType: "client" | "user" | "order" | "product" | "system";
  ownerId: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
}

export interface StoredFileResult {
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  metadata: FileMetadata;
}

export interface IFileStorage {
  saveFile(
    file: { buffer: Buffer; originalFilename: string; mimeType: string },
    metadata: FileMetadata
  ): Promise<StoredFileResult>;

  getFileStream(
    storageKey: string
  ): Promise<{ stream: Readable; mimeType: string; sizeBytes: number }>;

  deleteFile(storageKey: string): Promise<void>;
}
