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

export type ImportType = "materials" | "suppliers" | "machines" | "products" | "market_prices";

export interface DryRunReport {
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
  }): Promise<DryRunReport> {
    const { type, csvContent } = params;
    const fileHash = crypto.createHash("sha256").update(csvContent).digest("hex");
    const rows = this.parseCsv(csvContent);

    const errors: Array<{ row: number; error: string }> = [];
    let rowsOk = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      const err = this.validateRow(type, row, i + 2);
      if (err) {
        errors.push({ row: i + 2, error: err });
      } else {
        rowsOk++;
      }
    }

    return {
      type,
      totalRows: rows.length,
      rowsOk,
      rowsFailed: errors.length,
      errors,
      fileHash,
    };
  }

  async commit(params: {
    tenantId: string;
    type: ImportType;
    csvContent: string;
    fileHash: string;
    fileId?: string;
    actor: { id: string; email?: string; ip?: string; requestId?: string };
  }) {
    const { tenantId, type, csvContent, fileHash, fileId, actor } = params;

    // Idempotency: verify hash and check if already processed
    const computedHash = crypto.createHash("sha256").update(csvContent).digest("hex");
    if (computedHash !== fileHash) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, "File hash does not match uploaded content", 400);
    }

    const existingJob = await this.importJobRepo.findCompletedJob(tenantId, type, fileId);

    if (existingJob) {
      return existingJob; // Idempotent return
    }

    const rows = this.parseCsv(csvContent);
    const errors: Array<{ row: number; error: string }> = [];
    let rowsOk = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      const rowNum = i + 2;
      const err = this.validateRow(type, row, rowNum);

      if (err) {
        errors.push({ row: rowNum, error: err });
        continue;
      }

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
            trust: "trusted",
            verificationStatus: "verified",
          });
        }
        rowsOk++;
      } catch (insertErr: any) {
        errors.push({ row: rowNum, error: insertErr.message });
      }
    }

    const job = await this.importJobRepo.createJobRecord(tenantId, {
      type,
      status: errors.length === 0 ? "completed" : rowsOk > 0 ? "completed" : "failed",
      rowsOk,
      rowsFailed: errors.length,
      errors,
      fileId,
      createdBy: actor.id,
    });

    await this.auditService.log({
      tenantId,
      actor: { id: actor.id, type: "user", email: actor.email },
      action: "CSV_IMPORT_COMMITTED",
      entity: { collection: "importJobs", id: String(job._id) },
      after: { type, rowsOk, rowsFailed: errors.length },
      ip: actor.ip,
      requestId: actor.requestId,
    });

    return job;
  }
}
