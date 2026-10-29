import { Request, Response } from "express";
import { ImportService } from "../services/import.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { actorFrom } from "../utils/actor.js";
import { BadRequestError } from "../errors/index.js";

function getCsvContent(req: Request): string {
  if (typeof req.body === "string") {
    return req.body;
  }
  if (req.body && typeof req.body.csv === "string") {
    return req.body.csv;
  }
  if (Buffer.isBuffer(req.body)) {
    return req.body.toString("utf-8");
  }
  throw new BadRequestError("Expected CSV content in request body as text/csv or raw text");
}

export class ImportController {
  constructor(private readonly service: ImportService) {}

  getTemplate = asyncHandler(async (req: Request, res: Response) => {
    const type = req.params.type as "customers" | "suppliers" | "materials";
    if (!["customers", "suppliers", "materials"].includes(type)) {
      throw new BadRequestError("Invalid template type. Must be customers, suppliers, or materials");
    }

    const template = this.service.getTemplate(type);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${type}-template.csv"`);
    res.status(200).send(template);
  });

  importCustomers = asyncHandler(async (req: Request, res: Response) => {
    const csvContent = getCsvContent(req);
    const commit = req.query.commit === "true";
    const report = await this.service.importCustomers(actorFrom(req), csvContent, commit);

    if (commit && report.invalidRows > 0) {
      res.status(422).json({
        error: {
          code: "VALIDATION_FAILED",
          message: `CSV import failed with ${report.invalidRows} invalid row(s)`,
          details: report,
        },
        requestId: req.requestId,
      });
      return;
    }

    res.status(200).json({
      data: report,
      requestId: req.requestId,
    });
  });

  importSuppliers = asyncHandler(async (req: Request, res: Response) => {
    const csvContent = getCsvContent(req);
    const commit = req.query.commit === "true";
    const report = await this.service.importSuppliers(actorFrom(req), csvContent, commit);

    if (commit && report.invalidRows > 0) {
      res.status(422).json({
        error: {
          code: "VALIDATION_FAILED",
          message: `CSV import failed with ${report.invalidRows} invalid row(s)`,
          details: report,
        },
        requestId: req.requestId,
      });
      return;
    }

    res.status(200).json({
      data: report,
      requestId: req.requestId,
    });
  });

  importMaterials = asyncHandler(async (req: Request, res: Response) => {
    const csvContent = getCsvContent(req);
    const commit = req.query.commit === "true";
    const report = await this.service.importMaterials(actorFrom(req), csvContent, commit);

    if (commit && report.invalidRows > 0) {
      res.status(422).json({
        error: {
          code: "VALIDATION_FAILED",
          message: `CSV import failed with ${report.invalidRows} invalid row(s)`,
          details: report,
        },
        requestId: req.requestId,
      });
      return;
    }

    res.status(200).json({
      data: report,
      requestId: req.requestId,
    });
  });
}

