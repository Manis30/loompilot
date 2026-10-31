import crypto from "node:crypto";
import { ImportJobRepository } from "../repositories/import-job.repository.js";
import { MaterialRepository } from "../repositories/material.repository.js";
import { SupplierRepository } from "../repositories/supplier.repository.js";
import { MachineRepository } from "../repositories/machine.repository.js";
import { ProductRepository } from "../repositories/product.repository.js";
import { MarketPriceRepository } from "../repositories/market-price.repository.js";
import { AuditService } from "./audit.service.js";
import { AppError } from "../errors/app-error.js";
import { ErrorCode } from "@loompilot/shared";
import { IImportJob } from "../models/platform/import-job.model.js";

export type ImportType = "materials" | "suppliers" | "machines" | "products" | "market_prices";

const VALID_IMPORT_TYPES = new Set<ImportType>([
  "materials",
  "suppliers",
  "machines",
  "products",
  "market_prices",
]);

export const MAX_IMPORT_ROWS = 1000;
export const MAX_IMPORT_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export interface DryRunReport {
  jobId: string;
  type: ImportType;
  totalRows: number;
  rowsOk: number;
  rowsFailed: number;
  errors: Array<{ row: number; error: string }>;
  fileHash: string;
}

export class ImportService {
  constructor(
    private readonly importJobRepo = new ImportJobRepository(),
    private readonly materialRepo = new MaterialRepository(),
    private readonly supplierRepo = new SupplierRepository(),
    private readonly machineRepo = new MachineRepository(),
    private readonly productRepo = new ProductRepository(),
    private readonly marketPriceRepo = new MarketPriceRepository(),
    private readonly auditService = new AuditService()
  ) {}

  private parseCsv(csvText: string): Array<Record<string, string>> {
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2 || !lines[0]) return [];

    const headers = lines[0].split(",").map((h) => h.trim().replace(/^["']|["']$/g, ""));
    const rows: Array<Record<string, string>> = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const parts = line.split(",").map((p) => p.trim().replace(/^["']|["']$/g, ""));
      const row: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) {
        const header = headers[j];
        if (header) {
          row[header] = parts[j] ?? "";
        }
      }
      rows.push(row);
    }
    return rows;
  }

  private validateRow(type: ImportType, row: Record<string, string>, rowNum: number): string | null {
    switch (type) {
      case "materials":
        if (!row.materialName) return `Row ${rowNum}: materialName is required`;
        if (!["yarn", "fabric", "dye_chemical", "trim", "packing"].includes(row.type || "")) {
          return `Row ${rowNum}: type must be yarn, fabric, dye_chemical, trim, or packing`;
        }
        if (isNaN(Number(row.currentRatePaise)) || Number(row.currentRatePaise) <= 0) {
          return `Row ${rowNum}: currentRatePaise must be a positive integer`;
        }
        return null;

      case "suppliers":
        if (!row.supplierName) return `Row ${rowNum}: supplierName is required`;
        if (!row.phone) return `Row ${rowNum}: phone is required`;
        if (!row.city) return `Row ${rowNum}: city is required`;
        return null;

      case "machines":
        if (!row.machineCode) return `Row ${rowNum}: machineCode is required`;
        if (!row.machineName) return `Row ${rowNum}: machineName is required`;
        if (!row.processArea) return `Row ${rowNum}: processArea is required`;
        if (isNaN(Number(row.capacityUnitsPerDay)) || Number(row.capacityUnitsPerDay) <= 0) {
          return `Row ${rowNum}: capacityUnitsPerDay must be positive`;
        }
        return null;

      case "products":
        if (!row.productName) return `Row ${rowNum}: productName is required`;
        if (!row.category) return `Row ${rowNum}: category is required`;
        if (isNaN(Number(row.basePricePaise)) || Number(row.basePricePaise) <= 0) {
          return `Row ${rowNum}: basePricePaise must be positive`;
        }
        return null;

      case "market_prices":
        if (!row.materialId) return `Row ${rowNum}: materialId is required`;
        if (!row.date || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) return `Row ${rowNum}: date must be YYYY-MM-DD`;
        if (isNaN(Number(row.unitPricePaise)) || Number(row.unitPricePaise) <= 0) {
          return `Row ${rowNum}: unitPricePaise must be positive`;
        }
        return null;

      default:
        return `Unsupported import type '${type}'`;
    }
  }

  async dryRun(params: {
    tenantId: string;
    type: ImportType;
    csvContent: string;
    fileId?: string;
    actor: { id: string; email?: string; ip?: string; requestId?: string };
  }): Promise<DryRunReport> {
    const { tenantId, type, csvContent, fileId, actor } = params;

    if (!VALID_IMPORT_TYPES.has(type)) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, `Import type '${type}' is not supported`, 400);
    }

    if (Buffer.byteLength(csvContent, "utf8") > MAX_IMPORT_SIZE_BYTES) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, `CSV content exceeds maximum size of 5MB`, 400);
    }

    const rows = this.parseCsv(csvContent);
    if (rows.length > MAX_IMPORT_ROWS) {
      throw new AppError(
        ErrorCode.VALIDATION_FAILED,
        `CSV contains ${rows.length} rows, which exceeds the maximum limit of ${MAX_IMPORT_ROWS} rows`,
        400
      );
    }

    const fileHash = crypto.createHash("sha256").update(csvContent).digest("hex");
    const errors: Array<{ row: number; error: string }> = [];
    const validRows: Array<Record<string, string>> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      const err = this.validateRow(type, row, i + 2);
      if (err) {
        errors.push({ row: i + 2, error: err });
      } else {
        validRows.push(row);
      }
    }

    // Persist dry-run result in importJobs so commit doesn't need re-upload
    const jobRecord = await this.importJobRepo.createJobRecord(tenantId, {
      type,
      status: "pending",
      rowsOk: validRows.length,
      rowsFailed: errors.length,
      errors,
      fileHash,
      validRows,
      fileId,
      createdBy: actor.id,
    });

    return {
      jobId: String(jobRecord._id),
      type,
      totalRows: rows.length,
      rowsOk: validRows.length,
      rowsFailed: errors.length,
      errors,
      fileHash,
    };
  }

  async commit(params: {
    tenantId: string;
    jobId?: string;
    fileHash?: string;
    type?: ImportType;
    csvContent?: string;
    fileId?: string;
    actor: { id: string; email?: string; ip?: string; requestId?: string };
  }): Promise<IImportJob> {
    const { tenantId, jobId, fileHash, actor } = params;

    let job: IImportJob | null = null;
    if (jobId) {
      job = await this.importJobRepo.findById(tenantId, jobId);
    } else if (fileHash) {
      job = await this.importJobRepo.findByHash(tenantId, fileHash);
    }

    // If job was already committed, return immediately for idempotency
    if (job && job.status === "completed") {
      return job;
    }

    // If no stored job was found, but csvContent was provided as fallback
    if (!job && params.csvContent && fileHash && params.type) {
      const dryResult = await this.dryRun({
        tenantId,
        type: params.type,
        csvContent: params.csvContent,
        fileId: params.fileId,
        actor,
      });
      job = await this.importJobRepo.findById(tenantId, dryResult.jobId);
    }

    if (!job) {
      throw new AppError(
        ErrorCode.NOT_FOUND,
        "No matching import dry-run job found to commit. Run dry-run first.",
        404
      );
    }

    const type = job.type as ImportType;
    const validRows = job.validRows || [];
    const errors = job.errors || [];

    for (const row of validRows) {
      try {
        if (type === "materials") {
          await this.materialRepo.create(tenantId, {
            materialName: row.materialName || "",
            type: (row.type as any) || "yarn",
            currentRatePaise: parseInt(row.currentRatePaise || "0", 10),
            stockQty: row.stockQty ? Number(row.stockQty) : 0,
            reservedQty: 0,
            reorderLevel: row.reorderLevel ? Number(row.reorderLevel) : 0,
            unit: row.unit || "pcs",
            status: "active",
            version: 1,
          } as any);
        } else if (type === "suppliers") {
          await this.supplierRepo.create(tenantId, {
            supplierName: row.supplierName || "",
            contactPerson: row.contactPerson,
            email: row.email || "supplier@example.com",
            phone: row.phone || "",
            city: row.city || "",
            country: row.country || "India",
            status: "active",
            version: 1,
          });
        } else if (type === "machines") {
          await this.machineRepo.create(tenantId, {
            machineCode: (row.machineCode || "").toUpperCase(),
            machineName: row.machineName || "",
            processArea: row.processArea || "",
            capacityUnitsPerDay: Number(row.capacityUnitsPerDay || "0"),
            currentStatus: "available",
            version: 1,
          });
        } else if (type === "products") {
          await this.productRepo.create(tenantId, {
            productName: row.productName || "",
            category: row.category || "",
            basePricePaise: parseInt(row.basePricePaise || "0", 10),
            bom: [],
            routing: [],
            active: true,
            version: 1,
          } as any);
        } else if (type === "market_prices") {
          await this.marketPriceRepo.appendObservation(tenantId, row.materialId || "", row.date || "", {
            source: row.source || "historical_import",
            sourceType: (row.sourceType as any) || "supplier_quote",
            unitPricePaise: parseInt(row.unitPricePaise || "0", 10),
            trust: "normal",
            verificationStatus: "verified",
          });
        }
      } catch (err: any) {
        errors.push({ row: 0, error: `Commit error: ${err.message}` });
      }
    }

    const updatedJob = await this.importJobRepo.update(tenantId, String(job._id), {
      status: "completed",
      errors,
    });

    await this.auditService.log({
      tenantId,
      actor: { id: actor.id, type: "user", email: actor.email },
      action: "IMPORT_COMMITTED",
      entity: { collection: "importJobs", id: String(job._id) },
      after: {
        type: job.type,
        rowsOk: job.rowsOk,
        rowsFailed: errors.length,
      },
      ip: actor.ip,
      requestId: actor.requestId,
    });

    return updatedJob!;
  }
}
