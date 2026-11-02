import {
  IAgentsClient,
  AgentResult,
  FeasibilityRequest,
  QuotationDraftRequest,
  QuotationRecalculateRequest,
  MarketCheckRequest,
  ChatReplyRequest,
  MonitoringRequest,
  AdminAssistantAskRequest,
} from "../../interfaces/agents-client.interface.js";
import {
  InternalFeasibilityReport,
  InternalQuotationDraft,
  InternalQuotationRevision,
  InternalMarketObservation,
  InternalMonitoringSnapshot,
  InternalChatReply,
  InternalAdminAssistantRun,
} from "@loompilot/shared";

/**
 * FakeAgentsClient returns fixed, realistic sample payloads conforming to Schema v4 contracts.
 * In accordance with engineering rule 6, it uses fixed sample figures with NO formulas or dynamic calculations.
 */
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
      unitPricePaise: 27500, // ₹275.00
      totalPaise: 2750000, // ₹27,500.00 (for 100 pcs sample)
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

