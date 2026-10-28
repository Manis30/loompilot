import { z } from "zod";
import { OrderStatus } from "@loompilot/shared";

export const UpdateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
  actualDeliveryDate: z.string().optional(),
});

export type UpdateOrderStatusInput = z.infer<typeof UpdateOrderStatusSchema>;

