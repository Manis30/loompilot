import { z } from "zod";
import {
  InternalFeasibilityReport,
  InternalQuotationDraft,
  InternalQuotationRevision,
  InternalMarketObservation,
  InternalMonitoringSnapshot,
  InternalChatReply,
  InternalAdminAssistantRun,
} from "@loompilot/shared";

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

