import { z } from "zod";
import { AlertSeverity, AlertType } from "@loompilot/shared";

export const CreateAlertSchema = z.object({
  orderId: z.string().min(1, "orderId is required"),
  processId: z.string().min(1, "processId is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  type: z.nativeEnum(AlertType),
  severity: z.nativeEnum(AlertSeverity).optional().default(AlertSeverity.MEDIUM),
  title: z.string().min(1),
  message: z.string().min(1),
  metrics: z.object({
    requiredDaily: z.number().nonnegative(),
    actualRate: z.number().nonnegative(),
    deficitQty: z.number().nonnegative(),
    delayDaysEstimated: z.number().nonnegative(),
  }),
});

export const CreateRecommendationSchema = z.object({
  alertId: z.string().min(1, "alertId is required"),
  orderId: z.string().min(1, "orderId is required"),
  title: z.string().min(1),
  explanation: z.string().min(1),
  options: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string().min(1),
      description: z.string().min(1),
      extraWorkersNeeded: z.number().optional(),
      revisedDailyTarget: z.number().optional(),
      projectedCatchupDays: z.number().optional(),
      additionalCostPaise: z.number().int().nonnegative().optional().default(0),
    })
  ),
});

export const DecideRecommendationSchema = z.object({
  action: z.enum(["accept", "reject"]),
  selectedOptionId: z.string().optional(),
  rejectionReason: z.string().optional(),
});

export type CreateAlertInput = z.infer<typeof CreateAlertSchema>;
export type CreateRecommendationInput = z.infer<typeof CreateRecommendationSchema>;
export type DecideRecommendationInput = z.infer<typeof DecideRecommendationSchema>;

