import { z } from "zod";
import { OrderStatus, ProcessName } from "../enums.js";

export const ProcessPlanStepSchema = z.object({
  processId: z.string(),
  processName: z.nativeEnum(ProcessName),
  sequence: z.number().int().positive(),
  targetQty: z.number().positive(),
  dailyTarget: z.number().positive(),
  startDate: z.string(),
  endDate: z.string(),
  completedQty: z.number().nonnegative().default(0),
});

export const ProductionOrderSchema = z.object({
  id: z.string().optional(),
  tenantId: z.string().min(1),
  quotationId: z.string().min(1),
  customerId: z.string().min(1),
  orderNumber: z.string().min(1),
  productName: z.string().min(1),
  totalQuantity: z.number().positive(),
  unit: z.string(),
  status: z.nativeEnum(OrderStatus).default(OrderStatus.PLANNED),
  startDate: z.string(),
  targetDeliveryDate: z.string(),
  actualDeliveryDate: z.string().optional(),
  plan: z.array(ProcessPlanStepSchema),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export const DailyOutputEntrySchema = z.object({
  id: z.string().optional(),
  tenantId: z.string().min(1),
  orderId: z.string().min(1),
  processId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD"),
  quantityProduced: z.number().nonnegative(),
  quantityDefective: z.number().nonnegative().default(0),
  operatorId: z.string().optional(),
  notes: z.string().optional(),
  idempotencyKey: z.string().min(1),
});

export type ProcessPlanStep = z.infer<typeof ProcessPlanStepSchema>;
export type ProductionOrderDto = z.infer<typeof ProductionOrderSchema>;
export type DailyOutputEntryDto = z.infer<typeof DailyOutputEntrySchema>;

