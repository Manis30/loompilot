import { Request, Response } from "express";
import { ImportService, ImportType } from "../services/import.service.js";
import { AppError } from "../errors/app-error.js";
import { ErrorCode } from "@loompilot/shared";

export class ImportController {
  constructor(private readonly importService = new ImportService()) {}

  dryRun = async (req: Request, res: Response): Promise<void> => {
    const actor = req.actor!;
    const type = req.body.type as ImportType;
    let csvContent = req.body.csvContent as string;

    if (req.file) {
      csvContent = req.file.buffer.toString("utf-8");
    }

    if (!csvContent) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, "CSV content or file is required", 400);
    }

    const report = await this.importService.dryRun({
      tenantId: actor.tenantId,
      type,
      csvContent,
    });

    res.json({ data: report });
  };

  commit = async (req: Request, res: Response): Promise<void> => {
    const actor = req.actor!;
    const type = req.body.type as ImportType;
    const fileHash = req.body.fileHash as string;
    let csvContent = req.body.csvContent as string;

    if (req.file) {
      csvContent = req.file.buffer.toString("utf-8");
    }

    if (!csvContent || !fileHash) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, "CSV content and fileHash are required", 400);
    }

    const job = await this.importService.commit({
      tenantId: actor.tenantId,
      type,
      csvContent,
      fileHash,
      fileId: req.body.fileId,
      actor: {
        id: actor.subjectId,
        ip: req.ip,
        requestId: actor.requestId,
      },
    });

    res.status(201).json({ data: job });
  };
}
