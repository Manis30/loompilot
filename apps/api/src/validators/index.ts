import { Request, Response, NextFunction } from "express";
import { z, ZodSchema } from "zod";
import { AppError } from "../errors/app-error.js";
import { ErrorCode } from "@loompilot/shared";

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      next(new AppError(ErrorCode.VALIDATION_FAILED, "Request validation failed", 400, details));
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const details = result.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      next(new AppError(ErrorCode.VALIDATION_FAILED, "Query validation failed", 400, details));
      return;
    }
    req.query = result.data as any;
    next();
  };
}

export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      const details = result.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      next(new AppError(ErrorCode.VALIDATION_FAILED, "Path parameter validation failed", 400, details));
      return;
    }
    req.params = result.data as any;
    next();
  };
}

// ============================================================================
// Phase B Validation Schemas
// ============================================================================

export const IdParamSchema = z.object({
  id: z.string().min(1),
});

export const SettingsUpdateSchema = z.object({
  version: z.number().int().positive().optional(),
  timezone: z.string().optional(),
  minMarginPct: z.number().min(0).max(100).optional(),
  defaultMarginPct: z.number().min(0).max(100).optional(),
  advancePct: z.number().min(0).max(100).optional(),
  processConfig: z
    .array(
      z.object({
        area: z.string().min(1),
        hours: z.number().positive(),
        overlap: z.boolean(),
        fallbackOut: z.number().positive().optional(),
        usualWorkers: z.number().int().positive().optional(),
      })
    )
    .optional(),
  holidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  weeklyOffs: z.array(z.number().int().min(0).max(6)).optional(),
  marketRuntime: z.string().optional(),
  reportCutoff: z.string().optional(),
  safetyDays: z.number().int().nonnegative().optional(),
  quoteValidityDays: z.number().int().positive().optional(),
  riskBuffer: z
    .object({
      k: z.number().optional(),
      minPct: z.number().optional(),
      maxPct: z.number().optional(),
      windowDays: z.number().optional(),
    })
    .optional(),
  behindThresholdPct: z.number().optional(),
  maxBackdateDays: z.number().int().positive().optional(),
  priceThresholds: z
    .object({
      daily: z.number().optional(),
      sevenday: z.number().optional(),
      vol: z.number().optional(),
    })
    .optional(),
  quoteReminderDays: z.array(z.number().int().positive()).optional(),
  paymentReminderLeadDays: z.number().int().nonnegative().optional(),
  basePriceTolerancePct: z.number().nullable().optional(),
  marketSources: z
    .array(
      z.object({
        name: z.string().min(1),
        type: z.enum(["supplier_quote", "web", "feed"]),
        trust: z.enum(["trusted", "normal", "unverified"]),
        active: z.boolean().optional(),
        config: z.record(z.any()).optional(),
      })
    )
    .optional(),
});

export const ClientCreateSchema = z.object({
  clientName: z.string().min(1),
  contactPerson: z.string().optional(),
  email: z.string().email(),
  phone: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  customerType: z.string().optional(),
  paymentTermsDays: z.number().int().nonnegative().optional(),
  country: z.string().optional(),
});

export const ClientUpdateSchema = ClientCreateSchema.partial();

export const SupplierCreateSchema = z.object({
  supplierName: z.string().min(1),
  contactPerson: z.string().optional(),
  email: z.string().email(),
  phone: z.string().min(1),
  city: z.string().min(1),
  country: z.string().optional(),
  defaultLeadTimeDays: z.number().int().nonnegative().optional(),
});

export const SupplierUpdateSchema = SupplierCreateSchema.partial();

export const MaterialCreateSchema = z.object({
  materialName: z.string().min(1),
  type: z.enum(["yarn", "fabric", "dye_chemical", "trim", "packing"]),
  stockQty: z.number().nonnegative().optional(),
  reorderLevel: z.number().nonnegative().optional(),
  currentRatePaise: z.number().int().positive(),
  preferredSupplierId: z.string().optional(),
  unit: z.string().optional(),
  watchlist: z.boolean().optional(),
});

export const MaterialUpdateSchema = MaterialCreateSchema.partial();

export const MaterialRateUpdateSchema = z.object({
  currentRatePaise: z.number().int().positive(),
});

export const SupplierOffersUpdateSchema = z.object({
  supplierOffers: z.array(
    z.object({
      supplierId: z.string().min(1),
      ratePaise: z.number().int().positive(),
      leadDays: z.number().int().nonnegative(),
    })
  ),
});

export const MachineCreateSchema = z.object({
  machineCode: z.string().min(1),
  machineName: z.string().min(1),
  processArea: z.string().min(1),
  capacityUnitsPerDay: z.number().positive(),
  machineType: z.string().optional(),
});

export const MachineUpdateSchema = MachineCreateSchema.partial();

export const ProductCreateSchema = z.object({
  productName: z.string().min(1),
  category: z.string().min(1),
  basePricePaise: z.number().int().positive(),
  bom: z.array(
    z.object({
      materialId: z.string().min(1),
      qtyPerUnit: z.number().positive(),
      wastage: z.number().nonnegative().optional(),
    })
  ).min(1),
  routing: z.array(
    z.object({
      stage: z.string().min(1),
      seq: z.number().int().positive(),
      stdMinPerUnit: z.number().positive(),
    })
  ).min(1),
  imageFileIds: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});

export const ProductUpdateSchema = ProductCreateSchema.partial();

export const ProductImageSchema = z.object({
  fileId: z.string().min(1),
});

export const StockGoodsReceiptSchema = z.object({
  materialId: z.string().min(1),
  qty: z.number().positive(),
  unitCostPaise: z.number().int().positive(),
  supplierId: z.string().min(1),
  orderId: z.string().optional(),
  purchaseDecisionId: z.string().optional(),
});

export const StockAdjustSchema = z.object({
  materialId: z.string().min(1),
  deltaQty: z.number(),
  reason: z.string().min(1),
});

export const ImportDryRunSchema = z.object({
  type: z.enum(["materials", "suppliers", "machines", "products", "market_prices"]),
  csvContent: z.string().optional(),
});

export const ImportCommitSchema = z.object({
  type: z.enum(["materials", "suppliers", "machines", "products", "market_prices"]),
  fileHash: z.string().min(1),
  csvContent: z.string().optional(),
  fileId: z.string().optional(),
});
