import { z } from "zod";
import { AlertSeverity, AlertType, RecommendationStatus } from "../enums.js";

export const AlertSchema = z.object({
  id: z.string().optional(),
  tenantId: z.string().min(1),
  orderId: z.string().min(1),
  processId: z.string().min(1),
  date: z.string(),
  type: z.nativeEnum(AlertType),
  severity: z.nativeEnum(AlertSeverity),
  title: z.string().min(1),
  message: z.string().min(1),
  metrics: z.object({
    requiredDaily: z.number().nonnegative(),
    actualRate: z.number().nonnegative(),
    deficitQty: z.number().nonnegative(),
    delayDaysEstimated: z.number().nonnegative(),
  }),
  isAcknowledged: z.boolean().default(false),
  createdAt: z.date().optional(),
});

export const RecoveryOptionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  extraWorkersNeeded: z.number().int().nonnegative().optional(),
  revisedDailyTarget: z.number().nonnegative().optional(),
  projectedCatchupDays: z.number().nonnegative().optional(),
  additionalCostPaise: z.number().int().nonnegative().default(0),
});

export const RecommendationSchema = z.object({
  id: z.string().optional(),
  tenantId: z.string().min(1),
  alertId: z.string().min(1),
  orderId: z.string().min(1),
  status: z.nativeEnum(RecommendationStatus).default(RecommendationStatus.PROPOSED),
  title: z.string().min(1),
  explanation: z.string(),
  options: z.array(RecoveryOptionSchema),
  selectedOptionId: z.string().optional(),
  decidedBy: z.string().optional(),
  decidedAt: z.date().optional(),
  rejectionReason: z.string().optional(),
  createdAt: z.date().optional(),
});

export type AlertDto = z.infer<typeof AlertSchema>;
export type RecoveryOption = z.infer<typeof RecoveryOptionSchema>;
export type RecommendationDto = z.infer<typeof RecommendationSchema>;

