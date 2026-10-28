import { z } from "zod";

export const MarginReportSchema = z.object({
  tenantId: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  totalRevenuePaise: z.number().int().nonnegative(),
  totalCostPaise: z.number().int().nonnegative(),
  grossMarginPaise: z.number().int(),
  grossMarginPct: z.number(),
  orderBreakdown: z.array(
    z.object({
      orderId: z.string(),
      orderNumber: z.string(),
      revenuePaise: z.number().int().nonnegative(),
      costPaise: z.number().int().nonnegative(),
      marginPaise: z.number().int(),
      marginPct: z.number(),
    })
  ),
});

export const OnTimeDeliveryReportSchema = z.object({
  tenantId: z.string(),
  totalDeliveries: z.number().int().nonnegative(),
  onTimeDeliveries: z.number().int().nonnegative(),
  lateDeliveries: z.number().int().nonnegative(),
  onTimeRatePct: z.number().nonnegative(),
  averageDelayDays: z.number().nonnegative(),
});

export const CollectionsReportSchema = z.object({
  tenantId: z.string(),
  totalInvoicedPaise: z.number().int().nonnegative(),
  totalCollectedPaise: z.number().int().nonnegative(),
  totalOutstandingPaise: z.number().int().nonnegative(),
  totalOverduePaise: z.number().int().nonnegative(),
  agingSummary: z.object({
    currentPaise: z.number().int().nonnegative(),
    days1To30Paise: z.number().int().nonnegative(),
    days31To60Paise: z.number().int().nonnegative(),
    days61PlusPaise: z.number().int().nonnegative(),
  }),
});

export type MarginReportDto = z.infer<typeof MarginReportSchema>;
export type OnTimeDeliveryReportDto = z.infer<typeof OnTimeDeliveryReportSchema>;
export type CollectionsReportDto = z.infer<typeof CollectionsReportSchema>;

