export interface QuotationPdfLineItem {
  materialName: string;
  requiredQty: number;
  unit: string;
  unitCostPaise: number;
  totalCostPaise: number;
}

export interface QuotationPdfData {
  quotationNumber: string;
  customerName: string;
  validUntil: string;
  etaDate: string;
  lineItems: QuotationPdfLineItem[];
  subtotalCostPaise: number;
  riskBufferPct: number;
  riskBufferCostPaise: number;
  wastagePct: number;
  wastageCostPaise: number;
  marginPct: number;
  finalPricePaise: number;
  explanation: string;
}

export interface IPdfRenderer {
  renderQuotation(data: QuotationPdfData): Promise<Buffer>;
}
