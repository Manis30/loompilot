import { ICustomerRepository } from "../interfaces/customer.repository.js";
import { ISupplierRepository } from "../interfaces/supplier.repository.js";
import { IMaterialRepository } from "../interfaces/material.repository.js";
import { IUnitOfWork } from "../interfaces/unit-of-work.js";
import { IAuditLogRepository } from "../interfaces/audit-log.js";
import { Actor } from "../utils/actor.js";
import { MaterialType } from "@loompilot/shared";
import { z } from "zod";

export interface ImportErrorDetail {
  row: number;
  field: string;
  message: string;
}

export interface ImportReport {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: ImportErrorDetail[];
  preview: Array<Record<string, any>>;
  insertedCount?: number;
  skippedCount?: number;
}

export function parseCsv(text: string): Array<Record<string, string>> {
  const lines: string[][] = [];
  let currentField = "";
  let currentRecord: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        currentRecord.push(currentField.trim());
        currentField = "";
      } else if (char === "\r") {
        if (nextChar === "\n") {
          i++;
        }
        currentRecord.push(currentField.trim());
        lines.push(currentRecord);
        currentRecord = [];
        currentField = "";
      } else if (char === "\n") {
        currentRecord.push(currentField.trim());
        lines.push(currentRecord);
        currentRecord = [];
        currentField = "";
      } else {
        currentField += char;
      }
    }
  }

  if (currentField.length > 0 || currentRecord.length > 0) {
    currentRecord.push(currentField.trim());
    lines.push(currentRecord);
  }

  const nonEmptyLines = lines.filter((line) => line.some((col) => col.length > 0));
  if (nonEmptyLines.length === 0 || !nonEmptyLines[0]) return [];

  const headers = nonEmptyLines[0].map((h) => h.replace(/^["']|["']$/g, "").trim());
  const rows: Array<Record<string, string>> = [];

  for (let r = 1; r < nonEmptyLines.length; r++) {
    const line = nonEmptyLines[r];
    if (!line) continue;
    const rowObj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      const header = headers[c];
      if (header !== undefined) {
        rowObj[header] = line[c] !== undefined ? line[c]! : "";
      }
    }
    rows.push(rowObj);
  }

  return rows;
}

const ImportCustomerRowSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().optional(),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  address: z.string().optional(),
  gstin: z.string().optional(),
  paymentTermsDays: z
    .preprocess((v) => (v === "" || v === undefined ? 30 : Number(v)), z.number().int().nonnegative())
    .optional(),
});

const ImportSupplierRowSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().optional(),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  address: z.string().optional(),
  gstin: z.string().optional(),
  paymentTermsDays: z
    .preprocess((v) => (v === "" || v === undefined ? 30 : Number(v)), z.number().int().nonnegative())
    .optional(),
  leadTimeDays: z
    .preprocess((v) => (v === "" || v === undefined ? 7 : Number(v)), z.number().int().nonnegative())
    .optional(),
});

const ImportMaterialRowSchema = z.object({
  code: z.string().min(1, "Code is required"),
  name: z.string().min(1, "Name is required"),
  type: z.nativeEnum(MaterialType, {
    errorMap: () => ({ message: "Type must be one of yarn, chemical, dyes, packaging, other" }),
  }),
  unit: z.string().min(1, "Unit is required"),
  currentRatePaise: z.preprocess((v) => Number(v), z.number().int().nonnegative("currentRatePaise must be non-negative integer")),
  avgCostPaise: z
    .preprocess((v) => (v === "" || v === undefined ? undefined : Number(v)), z.number().int().nonnegative().optional()),
  reorderLevel: z
    .preprocess((v) => (v === "" || v === undefined ? 0 : Number(v)), z.number().nonnegative().optional()),
  preferredSupplierCode: z.string().optional(),
});

export class ImportService {
  constructor(
    private readonly customerRepo: ICustomerRepository,
    private readonly supplierRepo: ISupplierRepository,
    private readonly materialRepo: IMaterialRepository,
    private readonly uow: IUnitOfWork,
    private readonly audit?: IAuditLogRepository
  ) {}

  getTemplate(type: "customers" | "suppliers" | "materials"): string {
    switch (type) {
      case "customers":
        return `name,code,contactName,phone,email,address,gstin,paymentTermsDays\n"Acme Textiles","CUST-001","John Doe","+919876543210","john@acme.com","123 Mill Road, Surat","24AAACA1234A1Z5",30\n"Bharat Mills","CUST-002","Priya Sharma","+919876543211","priya@bharat.com","45 Industrial Area, Ahmedabad","24AAACB5678B1Z2",45\n`;
      case "suppliers":
        return `name,code,contactPerson,phone,email,address,gstin,paymentTermsDays,leadTimeDays\n"Supreme Yarns","SUP-001","Rajesh Kumar","+919876543220","sales@supremeyarns.com","Spinning Mill Road, Coimbatore","33AAACS1234C1Z1",30,7\n"Rainbow Dyes","SUP-002","Anita Patel","+919876543221","orders@rainbowdyes.com","Chemical Zone, Ankleshwar","24AAACR5678D1Z9",15,5\n`;
      case "materials":
        return `code,name,type,unit,currentRatePaise,avgCostPaise,reorderLevel,preferredSupplierCode\n"YARN-40S-COTTON","Cotton Yarn 40s Combed","yarn","kg",28000,28000,500,"SUP-001"\n"DYE-REACTIVE-BLUE","Reactive Blue 21","dyes","kg",45000,45000,100,"SUP-002"\n`;
    }
  }

  async importCustomers(
    actor: Actor,
    csvContent: string,
    commit: boolean = false
  ): Promise<ImportReport> {
    const rawRows = parseCsv(csvContent);
    const errors: ImportErrorDetail[] = [];
    const validData: any[] = [];

    rawRows.forEach((row, index) => {
      const rowNum = index + 2;
      const parsed = ImportCustomerRowSchema.safeParse(row);
      if (!parsed.success) {
        parsed.error.errors.forEach((err) => {
          errors.push({
            row: rowNum,
            field: err.path.join("."),
            message: err.message,
          });
        });
      } else {
        validData.push(parsed.data);
      }
    });

    const report: ImportReport = {
      totalRows: rawRows.length,
      validRows: validData.length,
      invalidRows: rawRows.length - validData.length,
      errors,
      preview: rawRows.slice(0, 5),
    };

    if (!commit || report.invalidRows > 0) {
      return report;
    }

    // Commit mode: insert batch skipping duplicates
    let insertedCount = 0;
    let skippedCount = 0;

    await this.uow.run(async (tx) => {
      for (const item of validData) {
        if (item.code) {
          const existing = await this.customerRepo.findByCode(actor.tenantId, item.code, tx);
          if (existing) {
            skippedCount++;
            continue;
          }
        }
        await this.customerRepo.create(
          {
            tenantId: actor.tenantId,
            name: item.name,
            code: item.code,
            contactPerson: item.contactName || item.name,
            phone: item.phone || "",
            email: item.email || `${item.name.toLowerCase().replace(/[^a-z0-9]/g, "")}@example.com`,
            address: item.address,
            gstin: item.gstin,
            creditPeriodDays: item.paymentTermsDays || 30,
            active: true,
          },
          tx
        );
        insertedCount++;
      }

      if (this.audit) {
        await this.audit.record(
          {
            tenantId: actor.tenantId,
            userId: actor.userId,
            userRole: actor.role,
            action: "CUSTOMERS_BULK_IMPORTED",
            entity: "customer",
            entityId: "bulk",
            changes: { insertedCount, skippedCount },
          },
          tx
        );
      }
    });

    report.insertedCount = insertedCount;
    report.skippedCount = skippedCount;
    return report;
  }

  async importSuppliers(
    actor: Actor,
    csvContent: string,
    commit: boolean = false
  ): Promise<ImportReport> {
    const rawRows = parseCsv(csvContent);
    const errors: ImportErrorDetail[] = [];
    const validData: any[] = [];

    rawRows.forEach((row, index) => {
      const rowNum = index + 2;
      const parsed = ImportSupplierRowSchema.safeParse(row);
      if (!parsed.success) {
        parsed.error.errors.forEach((err) => {
          errors.push({
            row: rowNum,
            field: err.path.join("."),
            message: err.message,
          });
        });
      } else {
        validData.push(parsed.data);
      }
    });

    const report: ImportReport = {
      totalRows: rawRows.length,
      validRows: validData.length,
      invalidRows: rawRows.length - validData.length,
      errors,
      preview: rawRows.slice(0, 5),
    };

    if (!commit || report.invalidRows > 0) {
      return report;
    }

    let insertedCount = 0;
    let skippedCount = 0;

    await this.uow.run(async (tx) => {
      for (const item of validData) {
        if (item.code) {
          const existing = await this.supplierRepo.findByCode(actor.tenantId, item.code, tx);
          if (existing) {
            skippedCount++;
            continue;
          }
        }
        await this.supplierRepo.create(
          {
            tenantId: actor.tenantId,
            name: item.name,
            code: item.code,
            contactPerson: item.contactPerson || item.name,
            phone: item.phone || "",
            email: item.email || `${item.name.toLowerCase().replace(/[^a-z0-9]/g, "")}@example.com`,
            address: item.address,
            gstin: item.gstin,
            paymentTermsDays: item.paymentTermsDays || 30,
            leadTimeDays: item.leadTimeDays || 7,
            active: true,
          },
          tx
        );
        insertedCount++;
      }

      if (this.audit) {
        await this.audit.record(
          {
            tenantId: actor.tenantId,
            userId: actor.userId,
            userRole: actor.role,
            action: "SUPPLIERS_BULK_IMPORTED",
            entity: "supplier",
            entityId: "bulk",
            changes: { insertedCount, skippedCount },
          },
          tx
        );
      }
    });

    report.insertedCount = insertedCount;
    report.skippedCount = skippedCount;
    return report;
  }

  async importMaterials(
    actor: Actor,
    csvContent: string,
    commit: boolean = false
  ): Promise<ImportReport> {
    const rawRows = parseCsv(csvContent);
    const errors: ImportErrorDetail[] = [];
    const validData: any[] = [];

    rawRows.forEach((row, index) => {
      const rowNum = index + 2;
      const parsed = ImportMaterialRowSchema.safeParse(row);
      if (!parsed.success) {
        parsed.error.errors.forEach((err) => {
          errors.push({
            row: rowNum,
            field: err.path.join("."),
            message: err.message,
          });
        });
      } else {
        validData.push(parsed.data);
      }
    });

    const report: ImportReport = {
      totalRows: rawRows.length,
      validRows: validData.length,
      invalidRows: rawRows.length - validData.length,
      errors,
      preview: rawRows.slice(0, 5),
    };

    if (!commit || report.invalidRows > 0) {
      return report;
    }

    let insertedCount = 0;
    let skippedCount = 0;

    await this.uow.run(async (tx) => {
      for (const item of validData) {
        const existing = await this.materialRepo.findByCode(actor.tenantId, item.code, tx);
        if (existing) {
          skippedCount++;
          continue;
        }

        let preferredSupplierId: string | undefined;
        if (item.preferredSupplierCode) {
          const supplier = await this.supplierRepo.findByCode(
            actor.tenantId,
            item.preferredSupplierCode,
            tx
          );
          if (supplier) {
            preferredSupplierId = supplier.id;
          }
        }

        await this.materialRepo.create(
          {
            tenantId: actor.tenantId,
            code: item.code,
            name: item.name,
            type: item.type,
            unit: item.unit,
            currentRatePaise: item.currentRatePaise,
            avgCostPaise: item.avgCostPaise ?? item.currentRatePaise,
            reorderLevel: item.reorderLevel || 0,
            preferredSupplierId,
            active: true,
          },
          tx
        );
        insertedCount++;
      }

      if (this.audit) {
        await this.audit.record(
          {
            tenantId: actor.tenantId,
            userId: actor.userId,
            userRole: actor.role,
            action: "MATERIALS_BULK_IMPORTED",
            entity: "material",
            entityId: "bulk",
            changes: { insertedCount, skippedCount },
          },
          tx
        );
      }
    });

    report.insertedCount = insertedCount;
    report.skippedCount = skippedCount;
    return report;
  }
}
