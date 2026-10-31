import { z } from "zod";

export const InternalFeasibilityReportSchema = z.object({
  schemaVersion: z.literal("1.0").default("1.0"),
  orderId: z.string().min(1),
  tenantId: z.string().min(1),
  verdict: z.enum(["feasible", "at_risk", "infeasible"]),
  etaDate: z.string(),
  bottleneckProcess: z.string().optional(),
  materialRequirements: z
    .array(
      z.object({
        materialId: z.string(),
        req: z.number().nonnegative(),
        avail: z.number().nonnegative(),
        short: z.number().nonnegative(),
      })
    )
    .optional(),
  materialReadyDate: z.string().optional(),
  processChecks: z
    .array(
      z.object({
        stage: z.string(),
        labourCap: z.number().optional(),
        machineCap: z.number().optional(),
        load: z.number().optional(),
        free: z.number().optional(),
        days: z.number().optional(),
        start: z.string().optional(),
        end: z.string().optional(),
      })
    )
    .optional(),
  riskFactors: z
    .array(
      z.object({
        type: z.string(),
        severity: z.enum(["low", "medium", "high"]),
      })
    )
    .optional(),
  recoveryOptions: z
    .array(
      z.object({
        optionId: z.string(),
        type: z.string(),
        details: z.record(z.any()).optional(),
        etaEffect: z.number().optional(),
        priceEffect: z.number().optional(),
      })
    )
    .optional(),
  reasonsSummary: z.string().optional(),
  lowData: z.boolean().optional(),
  agentRunId: z.string().optional(),
});

export const InternalQuotationDraftSchema = z.object({
  schemaVersion: z.literal("1.0").default("1.0"),
  orderId: z.string().min(1),
  tenantId: z.string().min(1),
  unitPricePaise: z.number().int().positive(),
  totalPaise: z.number().int().positive(),
  etaDate: z.string(),
  lineItems: z
    .array(
      z.object({
        desc: z.string(),
        qty: z.number().positive(),
        unitPricePaise: z.number().int().positive(),
      })
    )
    .optional(),
  paymentSchedule: z.array(
    z.object({
      milestone: z.string(),
      trigger: z.enum(["advance", "stage"]),
      stage: z.string().optional(),
      percent: z.number(),
      amountPaise: z.number().int().nonnegative(),
      dueDate: z.string().optional(),
    })
  ),
  processPlan: z
    .array(
      z.object({
        stage: z.string(),
        start: z.string(),
        end: z.string(),
        dailyTarget: z.number(),
      })
    )
    .optional(),
  etaBasis: z
    .object({
      supplierLead: z.number().optional(),
      prodDays: z.number().optional(),
      safetyDays: z.number().optional(),
    })
    .optional(),
  explanation: z.string().optional(),
  clientExplanation: z.string().optional(),
  termsVersion: z.string().optional(),
  priceVariationClause: z.string().optional(),
  lockedMaterials: z.array(z.string()).optional(),
  marginWarning: z.boolean().optional(),
  basePriceWarning: z.boolean().optional(),
  lowData: z.boolean().optional(),
  agentRunId: z.string().optional(),
  costing: z
    .object({
      materialCosts: z
        .array(
          z.object({
            materialId: z.string(),
            qty: z.number(),
            ratePaise: z.number().int(),
            paise: z.number().int(),
          })
        )
        .optional(),
      processingCosts: z
        .array(
          z.object({
            stage: z.string(),
            costing: z.any().optional(),
            paise: z.number().int(),
          })
        )
        .optional(),
      marginPct: z.number(),
      marginPaise: z.number().int(),
      wastagePaise: z.number().int().optional(),
      subtotalCostPaise: z.number().int().optional(),
      overheadCostPaise: z.number().int().optional(),
      riskBufferPaise: z.number().int().optional(),
    })
    .optional(),
});

export const InternalQuotationRevisionSchema = z.object({
  schemaVersion: z.literal("1.0").default("1.0"),
  orderId: z.string().min(1),
  tenantId: z.string().min(1),
  reasonType: z.enum(["price_surge", "admin_edit", "discount", "date_change"]),
  priceAlertRef: z
    .object({
      materialId: z.string().optional(),
      date: z.string().optional(),
    })
    .optional(),
  oldPricePaise: z.number().int().positive(),
  newPricePaise: z.number().int().positive(),
  changePct: z.number(),
  newEtaDate: z.string().optional(),
  clientReason: z.string(),
  agentRunId: z.string().optional(),
});

export const InternalMarketObservationSchema = z.object({
  schemaVersion: z.literal("1.0").default("1.0"),
  tenantId: z.string().min(1),
  observations: z.array(
    z.object({
      materialId: z.string(),
      ratePaise: z.number().int().positive(),
      source: z.enum(["supplier_quote", "web", "feed"]),
      trust: z.enum(["trusted", "normal", "unverified"]),
      observedAt: z.string().optional(),
      confidence: z.number().optional(),
    })
  ),
});

export const InternalMonitoringSnapshotSchema = z.object({
  schemaVersion: z.literal("1.0").default("1.0"),
  orderId: z.string().min(1),
  tenantId: z.string().min(1),
  phase: z.string(),
  percentComplete: z.number().min(0).max(100),
  onTrack: z.boolean(),
  predictedDelayDays: z.number().default(0),
  recommendations: z.array(z.string()).default([]),
  bottleneckStage: z.string().optional(),
  agentRunId: z.string().optional(),
});

export const InternalChatReplySchema = z.object({
  schemaVersion: z.literal("1.0").default("1.0"),
  conversationId: z.string().min(1),
  tenantId: z.string().min(1),
  messageText: z.string().min(1),
  agentType: z.enum(["client_copilot", "admin_copilot", "supervisor_assistant"]),
  suggestedActions: z
    .array(
      z.object({
        action: z.string(),
        label: z.string(),
        payload: z.record(z.any()).optional(),
      })
    )
    .optional(),
  agentRunId: z.string().optional(),
});

export const InternalAdminAssistantRunSchema = z.object({
  schemaVersion: z.literal("1.0").default("1.0"),
  tenantId: z.string().min(1),
  query: z.string().min(1),
  answer: z.string().min(1),
  sources: z.array(z.string()).default([]),
  suggestedQuestions: z.array(z.string()).default([]),
  agentRunId: z.string().optional(),
});

export type InternalFeasibilityReport = z.infer<typeof InternalFeasibilityReportSchema>;
export type InternalQuotationDraft = z.infer<typeof InternalQuotationDraftSchema>;
export type InternalQuotationRevision = z.infer<typeof InternalQuotationRevisionSchema>;
export type InternalMarketObservation = z.infer<typeof InternalMarketObservationSchema>;
export type InternalMonitoringSnapshot = z.infer<typeof InternalMonitoringSnapshotSchema>;
export type InternalChatReply = z.infer<typeof InternalChatReplySchema>;
export type InternalAdminAssistantRun = z.infer<typeof InternalAdminAssistantRunSchema>;
