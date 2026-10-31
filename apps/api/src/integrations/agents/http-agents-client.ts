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
  ErrorCode,
} from "@loompilot/shared";
import { logger } from "../../utils/logger.js";

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

        // Only retry for 5xx server errors
        if (response.status < 500) {
          const errText = await response.text();
          logger.warn({ endpoint, status: response.status, errText }, "Agent service client error");
          return {
            success: false,
            unavailable: false,
            error: `Agent service error ${response.status}: ${errText}`,
          };
        }

        logger.warn({ endpoint, attempt, status: response.status }, "Agent service returned 5xx, retrying...");
      } catch (err: any) {
        logger.warn({ endpoint, attempt, err: err.message }, "Network or timeout error contacting agent service");
      }

      if (attempt <= this.maxRetries) {
        // Exponential backoff
        await new Promise((res) => setTimeout(res, 200 * Math.pow(2, attempt - 1)));
      }
    }

    logger.error({ endpoint, attempts: attempt }, "Agent service unavailable after retries");
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
    return this.postWithRetry<InternalMarketObservation>("/agents/market/check", params);
  }

  async chatReply(params: ChatReplyRequest): Promise<AgentResult<InternalChatReply>> {
    return this.postWithRetry<InternalChatReply>("/agents/chat/reply", params);
  }

  async runMonitoring(params: MonitoringRequest): Promise<AgentResult<InternalMonitoringSnapshot>> {
    return this.postWithRetry<InternalMonitoringSnapshot>("/agents/monitoring", params);
  }

  async adminAssistantAsk(params: AdminAssistantAskRequest): Promise<AgentResult<InternalAdminAssistantRun>> {
    return this.postWithRetry<InternalAdminAssistantRun>("/agents/assistant/ask", params);
  }
}
