import { z } from "zod";
import { MaterialType, StockMovementType } from "@loompilot/shared";

export const CreateMaterialSchema = z.object({
  code: z.string().min(1, "code is required"),
  name: z.string().min(1, "name is required"),
  type: z.nativeEnum(MaterialType),
  unit: z.string().min(1, "unit is required"),
  currentRatePaise: z.number().int().nonnegative(),
  avgCostPaise: z.number().int().nonnegative(),
  onHandQuantity: z.number().nonnegative().optional(),
  reservedQuantity: z.number().nonnegative().optional(),
  reorderLevel: z.number().nonnegative().optional(),
  preferredSupplierId: z.string().optional(),
  active: z.boolean().optional().default(true),
});

export const UpdateMaterialSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.nativeEnum(MaterialType).optional(),
  unit: z.string().min(1).optional(),
  reorderLevel: z.number().nonnegative().optional(),
  preferredSupplierId: z.string().optional(),
  active: z.boolean().optional(),
});

export const RecordMovementSchema = z.object({
  type: z.nativeEnum(StockMovementType),
  quantity: z.number().positive("quantity must be positive"),
  referenceType: z.enum(["receipt", "order_issue", "reservation", "adjustment"]),
  referenceId: z.string().optional(),
  notes: z.string().optional(),
});

export const UpdateRateSchema = z.object({
  ratePaise: z.number().int().positive("ratePaise must be positive integer"),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "effectiveDate must be YYYY-MM-DD").optional(),
  source: z.string().optional().default("manual"),
  referenceId: z.string().optional(),
});

export const BackfillPriceHistorySchema = z.object({
  entries: z.array(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
      ratePaise: z.number().int().positive(),
      source: z.string().optional(),
    })
  ).min(1, "At least one price point is required"),
});

export const GoodsReceiptSchema = z.object({
  receivedQty: z.number().positive("receivedQty must be positive"),
  receivedCostPaise: z.number().int().positive("receivedCostPaise must be positive"),
  referenceId: z.string().optional(),
  notes: z.string().optional(),
});

export const StockAdjustmentSchema = z
  .object({
    newBalance: z.number().nonnegative("newBalance must be non-negative").optional(),
    newOnHandQuantity: z.number().nonnegative("newOnHandQuantity must be non-negative").optional(),
    reason: z.string().min(1, "reason is required for stock adjustment"),
  })
  .refine(
    (data) => data.newBalance !== undefined || data.newOnHandQuantity !== undefined,
    { message: "Either newBalance or newOnHandQuantity is required", path: ["newBalance"] }
  )
  .transform((data) => ({
    newBalance: (data.newBalance !== undefined ? data.newBalance : data.newOnHandQuantity) as number,
    reason: data.reason,
  }));

export type CreateMaterialInput = z.infer<typeof CreateMaterialSchema>;
export type UpdateMaterialInput = z.infer<typeof UpdateMaterialSchema>;
export type RecordMovementInput = z.infer<typeof RecordMovementSchema>;
export type UpdateRateInput = z.infer<typeof UpdateRateSchema>;
export type BackfillPriceHistoryInput = z.infer<typeof BackfillPriceHistorySchema>;
export type GoodsReceiptInput = z.infer<typeof GoodsReceiptSchema>;
export type StockAdjustmentInput = z.infer<typeof StockAdjustmentSchema>;
