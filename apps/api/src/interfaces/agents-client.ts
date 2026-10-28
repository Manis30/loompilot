export interface GenerateDraftRequest {
  tenantId: string;
  enquiryId: string;
}

export interface RecalculateQuotationRequest {
  tenantId: string;
  quotationId: string;
  lineItems?: Array<{
    materialId: string;
    requiredQty: number;
    unitCostPaise?: number;
  }>;
  marginPct?: number;
  assumptions?: string[];
}

export interface QuotationCalculationResult {
  lineItems: any[];
  materialCostPaise: number;
  processingCostPaise: number;
  overheadCostPaise: number;
  wastagePct: number;
  wastageCostPaise: number;
  riskBufferPct: number;
  riskBufferCostPaise: number;
  subtotalCostPaise: number;
  marginPct: number;
  profitPaise: number;
  finalPricePaise: number;
  etaDate: string;
  validUntil: string;
  explanation: string;
  assumptions: string[];
}

export interface IAgentsClient {
  requestDraft(req: GenerateDraftRequest): Promise<{ status: "queued" | "completed" | "failed"; error?: string }>;
  recalculate(req: RecalculateQuotationRequest): Promise<QuotationCalculationResult>;
}

