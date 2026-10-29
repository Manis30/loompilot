import { z } from "zod";

export const CreateProductSchema = z.object({
  code: z.string().min(1, "Product code is required"),
  name: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  unit: z.string().min(1, "Unit is required"),
  category: z.string().min(1, "Category is required"),
  active: z.boolean().optional().default(true),
});

export const UpdateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  unit: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  active: z.boolean().optional(),
});

export const BomItemSchema = z.object({
  materialId: z.string().min(1, "materialId is required"),
  quantityPerUnit: z.number().positive().optional(),
  quantity: z.number().positive().optional(),
  unit: z.string().min(1, "unit is required"),
  wastageAllowancePct: z.number().nonnegative().optional(),
  wastagePercent: z.number().nonnegative().optional(),
});

export const CreateBomSchema = z
  .object({
    items: z.array(BomItemSchema).optional(),
    materials: z.array(BomItemSchema).optional(),
    processes: z.array(z.any()).optional(),
    effectiveDate: z.string().optional(),
    effectiveFrom: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine(
    (data) =>
      (data.items && data.items.length > 0) ||
      (data.materials && data.materials.length > 0),
    {
      message: "Either items or materials array is required",
    }
  );

export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
export type CreateBomInput = z.infer<typeof CreateBomSchema>;
