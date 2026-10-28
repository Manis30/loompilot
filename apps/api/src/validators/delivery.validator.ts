import { z } from "zod";

export const RecordDeliverySchema = z.object({
  orderId: z.string().min(1, "orderId is required"),
  customerId: z.string().min(1, "customerId is required"),
  deliveredQuantity: z.number().int().positive("deliveredQuantity must be positive"),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "deliveryDate must be YYYY-MM-DD").optional(),
  totalInvoicePaise: z.number().int().nonnegative(),
  receivedBy: z.string().optional(),
  notes: z.string().optional(),
});

export type RecordDeliveryInput = z.infer<typeof RecordDeliverySchema>;
