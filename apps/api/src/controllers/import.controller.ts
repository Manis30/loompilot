import { Request, Response, NextFunction } from "express";
import { ImportService, ImportType } from "../services/import.service.js";
import { AppError } from "../errors/app-error.js";
import { ErrorCode } from "@loompilot/shared";

export class ImportController {
  constructor(private readonly importService = new ImportService()) {}

  dryRun = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
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
        fileId: req.body.fileId,
        actor: {
          id: actor.subjectId,
          ip: req.ip,
          requestId: actor.requestId,
        },
      });

      res.json({ data: report });
    } catch (err) {
      next(err);
    }
  };

  commit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const jobId = req.body.jobId as string | undefined;
      const fileHash = req.body.fileHash as string | undefined;
      const type = req.body.type as ImportType | undefined;
      let csvContent = req.body.csvContent as string | undefined;

      if (req.file) {
        csvContent = req.file.buffer.toString("utf-8");
      }

      if (!jobId && !fileHash && !csvContent) {
        throw new AppError(ErrorCode.VALIDATION_FAILED, "jobId or fileHash is required to commit import", 400);
      }

      const job = await this.importService.commit({
        tenantId: actor.tenantId,
        jobId,
        fileHash,
        type,
        csvContent,
        fileId: req.body.fileId,
        actor: {
          id: actor.subjectId,
          ip: req.ip,
          requestId: actor.requestId,
        },
      });

      res.status(201).json({ data: job });
    } catch (err) {
      next(err);
    }
  };
}
