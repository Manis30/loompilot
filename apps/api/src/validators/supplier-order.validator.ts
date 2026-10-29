import { z } from "zod";

export const SupplierOrderItemInputSchema = z.object({
  materialId: z.string().min(1, "materialId is required"),
  quantity: z.number().positive("quantity must be positive"),
  unitCostPaise: z.number().int().nonnegative("unitCostPaise must be non-negative integer"),
});

export const CreateSupplierOrderSchema = z.object({
  supplierId: z.string().min(1, "supplierId is required"),
  items: z.array(SupplierOrderItemInputSchema).min(1, "At least one item is required"),
  expectedDeliveryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "expectedDeliveryDate must be YYYY-MM-DD")
    .optional(),
  notes: z.string().optional(),
});

export const UpdateSupplierOrderSchema = z.object({
  supplierId: z.string().optional(),
  items: z.array(SupplierOrderItemInputSchema).optional(),
  status: z.enum(["draft", "placed", "cancelled"]).optional(),
  expectedDeliveryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "expectedDeliveryDate must be YYYY-MM-DD")
    .optional(),
  notes: z.string().optional(),
});

export const ReceiveSupplierOrderItemSchema = z.object({
  materialId: z.string().min(1, "materialId is required"),
  quantity: z.number().positive("quantity must be positive"),
  unitCostPaise: z.number().int().positive().optional(),
});

export const ReceiveSupplierOrderSchema = z.object({
  items: z.array(ReceiveSupplierOrderItemSchema).min(1, "At least one item is required"),
  notes: z.string().optional(),
});

export type CreateSupplierOrderInput = z.infer<typeof CreateSupplierOrderSchema>;
export type UpdateSupplierOrderInput = z.infer<typeof UpdateSupplierOrderSchema>;
export type ReceiveSupplierOrderInput = z.infer<typeof ReceiveSupplierOrderSchema>;

