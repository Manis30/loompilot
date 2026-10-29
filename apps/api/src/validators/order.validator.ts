import { z } from "zod";
import { OrderStatus } from "@loompilot/shared";

export const UpdateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
  actualDeliveryDate: z.string().optional(),
});

export const IssueMaterialsSchema = z.object({
  items: z
    .array(
      z.object({
        materialId: z.string().min(1, "materialId is required"),
        quantity: z.number().positive("quantity must be positive"),
      })
    )
    .min(1, "At least one item is required"),
  notes: z.string().optional(),
});

export type UpdateOrderStatusInput = z.infer<typeof UpdateOrderStatusSchema>;
export type IssueMaterialsInput = z.infer<typeof IssueMaterialsSchema>;

