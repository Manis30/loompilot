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
});

export const RecordMovementSchema = z.object({
  type: z.nativeEnum(StockMovementType),
  quantity: z.number().positive("quantity must be positive"),
  referenceType: z.enum(["receipt", "order_issue", "reservation", "adjustment"]),
  referenceId: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateMaterialInput = z.infer<typeof CreateMaterialSchema>;
export type RecordMovementInput = z.infer<typeof RecordMovementSchema>;

