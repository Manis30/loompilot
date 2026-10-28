import { z } from "zod";

export const CreateQuotationDraftSchema = z.object({
  enquiryId: z.string().min(1, "enquiryId is required"),
  customerId: z.string().min(1, "customerId is required"),
  lineItems: z.array(
    z.object({
      materialId: z.string().min(1),
      materialName: z.string().min(1),
      requiredQty: z.number().positive(),
      unit: z.string().min(1),
      onHandQty: z.number().nonnegative(),
      reservedQty: z.number().nonnegative(),
      toPurchaseQty: z.number().nonnegative(),
      unitCostPaise: z.number().int().nonnegative(),
      totalCostPaise: z.number().int().nonnegative(),
      supplierLeadDays: z.number().int().nonnegative(),
    })
  ),
  materialCostPaise: z.number().int().nonnegative(),
  processingCostPaise: z.number().int().nonnegative(),
  overheadCostPaise: z.number().int().nonnegative(),
  wastagePct: z.number().nonnegative(),
  wastageCostPaise: z.number().int().nonnegative(),
  riskBufferPct: z.number().nonnegative(),
  riskBufferCostPaise: z.number().int().nonnegative(),
  subtotalCostPaise: z.number().int().nonnegative(),
  marginPct: z.number().nonnegative(),
  profitPaise: z.number().int().nonnegative(),
  finalPricePaise: z.number().int().positive(),
  etaDate: z.string().min(1),
  validUntil: z.string().min(1),
  explanation: z.string().optional().default(""),
  assumptions: z.array(z.string()).optional().default([]),
  inputsSnapshot: z.record(z.any()).optional().default({}),
});

export type CreateQuotationDraftInput = z.infer<typeof CreateQuotationDraftSchema>;

