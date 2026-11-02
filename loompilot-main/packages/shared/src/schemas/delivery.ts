import { z } from "zod";
import { DeliveryStatus } from "../enums.js";

export const DeliveryRecordSchema = z.object({
  id: z.string().optional(),
  tenantId: z.string().min(1),
  orderId: z.string().min(1),
  customerId: z.string().min(1),
  deliveryNumber: z.string().min(1),
  deliveredQuantity: z.number().positive(),
  deliveryDate: z.string(),
  status: z.nativeEnum(DeliveryStatus).default(DeliveryStatus.DELIVERED),
  isOnTime: z.boolean(),
  invoiceNumber: z.string().min(1),
  totalInvoicePaise: z.number().int().positive(),
  receivedBy: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.date().optional(),
});

export type DeliveryRecordDto = z.infer<typeof DeliveryRecordSchema>;

