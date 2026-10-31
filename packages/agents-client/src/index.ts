import { z } from "zod";
import {
  InternalFeasibilityReport,
  InternalQuotationDraft,
  InternalQuotationRevision,
  InternalMarketObservation,
  InternalMonitoringSnapshot,
  InternalChatReply,
  InternalAdminAssistantRun,
  ErrorCode,
} from "@loompilot/shared";

export const AGENTS_CLIENT_VERSION = "0.1.0";

// Schemas & Request Types
export const FeasibilityRequestSchema = z.object({
  tenantId: z.string().min(1),
  orderId: z.string().min(1),
  productId: z.string().optional(),
  productDescription: z.string().optional(),
  quantity: z.number().positive(),
  deadline: z.string(),
  spec: z.record(z.any()).optional(),
});

export const QuotationDraftRequestSchema = z.object({
  tenantId: z.string().min(1),
  orderId: z.string().min(1),
  productId: z.string().optional(),
  quantity: z.number().positive(),
  deadline: z.string().optional(),
  feasibilityVerdict: z.string().optional(),
});

export const QuotationRecalculateRequestSchema = z.object({
  tenantId: z.string().min(1),
  orderId: z.string().min(1),
  reasonType: z.enum(["price_surge", "admin_edit", "discount", "date_change"]),
  targetPricePaise: z.number().int().positive().optional(),
  targetEtaDate: z.string().optional(),
  discountPct: z.number().optional(),
});

export const MarketCheckRequestSchema = z.object({
  tenantId: z.string().min(1),
  materialIds: z.array(z.string()).optional(),
});

export const ChatReplyRequestSchema = z.object({
  tenantId: z.string().min(1),
  conversationId: z.string().min(1),
  orderId: z.string().optional(),
  clientId: z.string().optional(),
  lastMessage: z.string(),
  senderRole: z.string(),
});

export const MonitoringRequestSchema = z.object({
  tenantId: z.string().min(1),
  orderId: z.string().min(1),
});

export const AdminAssistantAskRequestSchema = z.object({
  tenantId: z.string().min(1),
  userId: z.string().min(1),
  query: z.string().min(1),
});

export type FeasibilityRequest = z.infer<typeof FeasibilityRequestSchema>;
export type QuotationDraftRequest = z.infer<typeof QuotationDraftRequestSchema>;
export type QuotationRecalculateRequest = z.infer<typeof QuotationRecalculateRequestSchema>;
export type MarketCheckRequest = z.infer<typeof MarketCheckRequestSchema>;
export type ChatReplyRequest = z.infer<typeof ChatReplyRequestSchema>;
export type MonitoringRequest = z.infer<typeof MonitoringRequestSchema>;
export type AdminAssistantAskRequest = z.infer<typeof AdminAssistantAskRequestSchema>;

export interface AgentResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  unavailable?: boolean;
}

export interface IAgentsClient {
  requestFeasibility(params: FeasibilityRequest): Promise<AgentResult<InternalFeasibilityReport>>;
  requestQuotationDraft(params: QuotationDraftRequest): Promise<AgentResult<InternalQuotationDraft>>;
  recalculateQuotation(params: QuotationRecalculateRequest): Promise<AgentResult<InternalQuotationRevision>>;
  runMarketCheck(params: MarketCheckRequest): Promise<AgentResult<InternalMarketObservation>>;
  chatReply(params: ChatReplyRequest): Promise<AgentResult<InternalChatReply>>;
  runMonitoring(params: MonitoringRequest): Promise<AgentResult<InternalMonitoringSnapshot>>;
  adminAssistantAsk(params: AdminAssistantAskRequest): Promise<AgentResult<InternalAdminAssistantRun>>;
}

export class FakeAgentsClient implements IAgentsClient {
  async requestFeasibility(params: FeasibilityRequest): Promise<AgentResult<InternalFeasibilityReport>> {
    const report: InternalFeasibilityReport = {
      schemaVersion: "1.0",
      orderId: params.orderId,
      tenantId: params.tenantId,
      verdict: "feasible",
      etaDate: "2026-11-20",
      bottleneckProcess: "stitching",
      materialRequirements: [
        { materialId: "65f000000000000000000001", req: 220, avail: 5000, short: 0 },
        { materialId: "65f000000000000000000002", req: 20, avail: 1000, short: 0 },
      ],
      materialReadyDate: "2026-11-05",
      processChecks: [
        { stage: "knitting", days: 3, start: "2026-11-06", end: "2026-11-08" },
        { stage: "dyeing_processing", days: 2, start: "2026-11-09", end: "2026-11-10" },
        { stage: "cutting", days: 1, start: "2026-11-11", end: "2026-11-11" },
        { stage: "stitching", days: 5, start: "2026-11-12", end: "2026-11-16" },
        { stage: "checking", days: 1, start: "2026-11-17", end: "2026-11-17" },
        { stage: "ironing_finishing", days: 1, start: "2026-11-18", end: "2026-11-18" },
        { stage: "packing", days: 1, start: "2026-11-19", end: "2026-11-19" },
      ],
      riskFactors: [{ type: "lead_time", severity: "low" }],
      reasonsSummary: "All materials on hand; machine and labour capacity available across all stages.",
      lowData: false,
    };
    return { success: true, data: report };
  }

  async requestQuotationDraft(params: QuotationDraftRequest): Promise<AgentResult<InternalQuotationDraft>> {
    const draft: InternalQuotationDraft = {
      schemaVersion: "1.0",
      orderId: params.orderId,
      tenantId: params.tenantId,
      unitPricePaise: 27500,
      totalPaise: 2750000,
      etaDate: "2026-11-22",
      lineItems: [
        { desc: "Classic Crewneck T-Shirt (100% Combed Cotton)", qty: params.quantity || 100, unitPricePaise: 27500 },
      ],
      paymentSchedule: [
        { milestone: "advance", trigger: "advance", percent: 30, amountPaise: 825000 },
        { milestone: "post_dyeing", trigger: "stage", stage: "dyeing_processing", percent: 30, amountPaise: 825000 },
        { milestone: "dispatch", trigger: "stage", stage: "packing", percent: 40, amountPaise: 1100000 },
      ],
      processPlan: [
        { stage: "knitting", start: "2026-11-06", end: "2026-11-08", dailyTarget: 35 },
        { stage: "dyeing_processing", start: "2026-11-09", end: "2026-11-10", dailyTarget: 50 },
        { stage: "cutting", start: "2026-11-11", end: "2026-11-11", dailyTarget: 100 },
        { stage: "stitching", start: "2026-11-12", end: "2026-11-16", dailyTarget: 40 },
        { stage: "checking", start: "2026-11-17", end: "2026-11-17", dailyTarget: 100 },
        { stage: "ironing_finishing", start: "2026-11-18", end: "2026-11-18", dailyTarget: 100 },
        { stage: "packing", start: "2026-11-19", end: "2026-11-19", dailyTarget: 150 },
      ],
      etaBasis: { supplierLead: 0, prodDays: 14, safetyDays: 3 },
      explanation: "Costed with 18% standard margin, yarn reserved from warehouse inventory.",
      clientExplanation: "Competitive quotation with expedited delivery using premium combed cotton.",
      termsVersion: "v1.0",
      priceVariationClause: "Valid for 14 days subject to standard cotton yarn index stability.",
      costing: {
        materialCosts: [
          { materialId: "65f000000000000000000001", qty: 22, ratePaise: 28500, paise: 627000 },
        ],
        processingCosts: [
          { stage: "knitting", paise: 250000 },
          { stage: "stitching", paise: 400000 },
        ],
        marginPct: 18,
        marginPaise: 420000,
        wastagePaise: 50000,
        subtotalCostPaise: 2330000,
        overheadCostPaise: 150000,
        riskBufferPaise: 50000,
      },
    };
    return { success: true, data: draft };
  }

  async recalculateQuotation(params: QuotationRecalculateRequest): Promise<AgentResult<InternalQuotationRevision>> {
    const revision: InternalQuotationRevision = {
      schemaVersion: "1.0",
      orderId: params.orderId,
      tenantId: params.tenantId,
      reasonType: params.reasonType,
      oldPricePaise: 2750000,
      newPricePaise: params.targetPricePaise || 2600000,
      changePct: -5.45,
      newEtaDate: params.targetEtaDate || "2026-11-22",
      clientReason: "Special client loyalty discount approved by management.",
    };
    return { success: true, data: revision };
  }

  async runMarketCheck(params: MarketCheckRequest): Promise<AgentResult<InternalMarketObservation>> {
    const obs: InternalMarketObservation = {
      schemaVersion: "1.0",
      tenantId: params.tenantId,
      observations: [
        {
          materialId: params.materialIds?.[0] || "65f000000000000000000001",
          ratePaise: 28500,
          source: "supplier_quote",
          trust: "trusted",
          observedAt: new Date().toISOString(),
          confidence: 0.95,
        },
      ],
    };
    return { success: true, data: obs };
  }

  async chatReply(params: ChatReplyRequest): Promise<AgentResult<InternalChatReply>> {
    const reply: InternalChatReply = {
      schemaVersion: "1.0",
      conversationId: params.conversationId,
      tenantId: params.tenantId,
      messageText: "Hello! We have reviewed your request and confirmed that production is progressing on track for delivery as scheduled.",
      agentType: "client_copilot",
    };
    return { success: true, data: reply };
  }

  async runMonitoring(params: MonitoringRequest): Promise<AgentResult<InternalMonitoringSnapshot>> {
    const snapshot: InternalMonitoringSnapshot = {
      schemaVersion: "1.0",
      orderId: params.orderId,
      tenantId: params.tenantId,
      phase: "stitching",
      percentComplete: 65,
      onTrack: true,
      predictedDelayDays: 0,
      recommendations: ["Maintain current stitching throughput to meet packaging handover on date."],
      bottleneckStage: "stitching",
    };
    return { success: true, data: snapshot };
  }

  async adminAssistantAsk(params: AdminAssistantAskRequest): Promise<AgentResult<InternalAdminAssistantRun>> {
    const run: InternalAdminAssistantRun = {
      schemaVersion: "1.0",
      tenantId: params.tenantId,
      query: params.query,
      answer: "Current mill capacity is operating at 78% utilization. Stitching line 2 has scheduled maintenance on Friday.",
      sources: ["supervisorDailyReports", "maintenanceTickets", "machines"],
      suggestedQuestions: ["Which orders are running on stitching line 2?", "What is the expected completion time?"],
    };
    return { success: true, data: run };
  }
}

export class HttpAgentsClient implements IAgentsClient {
  private readonly baseUrl: string;
  private readonly serviceToken: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(options: {
    baseUrl: string;
    serviceToken: string;
    timeoutMs?: number;
    maxRetries?: number;
  }) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.serviceToken = options.serviceToken;
    this.timeoutMs = options.timeoutMs ?? 15000;
    this.maxRetries = options.maxRetries ?? 2;
  }

  private async postWithRetry<T>(endpoint: string, payload: unknown): Promise<AgentResult<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    let attempt = 0;

    while (attempt <= this.maxRetries) {
      attempt++;
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Service-Token": this.serviceToken,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.timeoutMs),
        });

        if (response.ok) {
          const data = (await response.json()) as T;
          return { success: true, data };
        }

        if (response.status < 500) {
          const errText = await response.text();
          return {
            success: false,
            unavailable: false,
            error: `Agent service error ${response.status}: ${errText}`,
          };
        }
      } catch (err: any) {
        // Network or timeout
      }

      if (attempt <= this.maxRetries) {
        await new Promise((res) => setTimeout(res, 200 * Math.pow(2, attempt - 1)));
      }
    }

    return {
      success: false,
      unavailable: true,
      error: ErrorCode.AGENTS_UNAVAILABLE,
    };
  }

  async requestFeasibility(params: FeasibilityRequest): Promise<AgentResult<InternalFeasibilityReport>> {
    return this.postWithRetry<InternalFeasibilityReport>("/agents/feasibility", params);
  }

  async requestQuotationDraft(params: QuotationDraftRequest): Promise<AgentResult<InternalQuotationDraft>> {
    return this.postWithRetry<InternalQuotationDraft>("/agents/quotation", params);
  }

  async recalculateQuotation(params: QuotationRecalculateRequest): Promise<AgentResult<InternalQuotationRevision>> {
    return this.postWithRetry<InternalQuotationRevision>("/agents/quotation/recalculate", params);
  }

  async runMarketCheck(params: MarketCheckRequest): Promise<AgentResult<InternalMarketObservation>> {
    return this.postWithRetry<InternalMarketObservation>("/agents/market-check", params);
  }

  async chatReply(params: ChatReplyRequest): Promise<AgentResult<InternalChatReply>> {
    return this.postWithRetry<InternalChatReply>("/agents/chat-reply", params);
  }

  async runMonitoring(params: MonitoringRequest): Promise<AgentResult<InternalMonitoringSnapshot>> {
    return this.postWithRetry<InternalMonitoringSnapshot>("/agents/monitoring", params);
  }

  async adminAssistantAsk(params: AdminAssistantAskRequest): Promise<AgentResult<InternalAdminAssistantRun>> {
    return this.postWithRetry<InternalAdminAssistantRun>("/agents/assistant-ask", params);
  }
}
