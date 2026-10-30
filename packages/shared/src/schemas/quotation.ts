import { z } from "zod";
import { QuotationStatus } from "../enums.js";

export const QuotationLineItemSchema = z.object({
  materialId: z.string(),
  materialName: z.string(),
  requiredQty: z.number().nonnegative(),
  unit: z.string(),
  onHandQty: z.number().nonnegative(),
  reservedQty: z.number().nonnegative(),
  toPurchaseQty: z.number().nonnegative(),
  unitCostPaise: z.number().int().nonnegative(),
  totalCostPaise: z.number().int().nonnegative(),
  supplierLeadDays: z.number().int().nonnegative(),
});

export const QuotationProposalSchema = z.object({
  tenantId: z.string().min(1),
  enquiryId: z.string().min(1),
  customerId: z.string().min(1),
  lineItems: z.array(QuotationLineItemSchema),
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
  etaDate: z.string(),
  validUntil: z.string(),
  explanation: z.string(),
  assumptions: z.array(z.string()).default([]),
  inputsSnapshot: z.record(z.any()).default({}),
});

export const QuotationRecalculateRequestSchema = z.object({
  quotationId: z.string(),
  tenantId: z.string(),
  wastagePct: z.number().nonnegative().optional(),
  marginPct: z.number().nonnegative().optional(),
  riskBufferPct: z.number().nonnegative().optional(),
  targetQty: z.number().positive().optional(),
});

export const QuotationSchema = QuotationProposalSchema.extend({
  id: z.string().optional(),
  status: z.nativeEnum(QuotationStatus).default(QuotationStatus.PENDING_APPROVAL),
  generationError: z.string().optional(),
  approvedBy: z.string().optional(),
  approvedAt: z.date().optional(),
  sentAt: z.date().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type QuotationLineItem = z.infer<typeof QuotationLineItemSchema>;
export type QuotationProposal = z.infer<typeof QuotationProposalSchema>;
export type QuotationRecalculateRequest = z.infer<typeof QuotationRecalculateRequestSchema>;
export type QuotationDto = z.infer<typeof QuotationSchema>;

