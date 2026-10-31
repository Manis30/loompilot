import { Request, Response } from "express";
import { FileService } from "../services/file.service.js";
import { AppError } from "../errors/app-error.js";
import { ErrorCode } from "@loompilot/shared";

export class FileController {
  constructor(private readonly fileService = new FileService()) {}

  uploadFile = async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, "No file provided in multipart upload", 400);
    }

    const actor = req.actor!;
    const ownerRealm = actor.realm;
    const ownerId = actor.realm === "client" ? (actor.clientId || actor.subjectId) : actor.subjectId;

    const fileDoc = await this.fileService.uploadFile({
      tenantId: actor.tenantId,
      file: {
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      },
      ownerRealm,
      ownerId,
      actor: {
        id: actor.subjectId,
        ip: req.ip,
        requestId: actor.requestId,
      },
    });

    res.status(201).json({
      data: {
        fileId: String(fileDoc._id),
        name: fileDoc.name,
        size: fileDoc.size,
        mime: fileDoc.mime,
        createdAt: fileDoc.createdAt,
      },
    });
  };

  downloadFile = async (req: Request, res: Response): Promise<void> => {
    const actor = req.actor!;

    const fileData = await this.fileService.getFileForDownload({
      tenantId: actor.tenantId,
      fileId: req.params.id as string,
      requester: {
        realm: actor.realm,
        clientId: actor.clientId,
        userId: actor.realm === "user" ? actor.subjectId : undefined,
      },
    });

    res.setHeader("Content-Type", fileData.mime);
    res.setHeader("Content-Length", fileData.size);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(fileData.name)}"`);

    fileData.stream.pipe(res);
  };
}
