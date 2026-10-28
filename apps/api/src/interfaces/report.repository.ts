export interface QuotationSummary {
  id: string;
  quotationNumber: string;
  finalPricePaise: number;
  subtotalCostPaise?: number;
  wastageCostPaise?: number;
  riskBufferCostPaise?: number;
}

export interface DeliverySummary {
  id: string;
  isOnTime: boolean;
}

export interface PaymentSummary {
  id: string;
  totalInvoicePaise: number;
  amountReceivedPaise: number;
  balancePaise: number;
  dueDate: string;
}

export interface MarginReport {
  tenantId: string;
  totalRevenuePaise: number;
  totalCostPaise: number;
  grossMarginPaise: number;
  grossMarginPct: number;
  orderBreakdown: Array<{
    quotationId: string;
    quotationNumber: string;
    revenuePaise: number;
    costPaise: number;
    marginPaise: number;
    marginPct: number;
  }>;
}

export interface OnTimeRateReport {
  tenantId: string;
  totalDeliveries: number;
  onTimeDeliveries: number;
  lateDeliveries: number;
  onTimeRatePct: number;
  averageDelayDays: number;
}

export interface CollectionsReport {
  tenantId: string;
  totalInvoicedPaise: number;
  totalCollectedPaise: number;
  totalOutstandingPaise: number;
  totalOverduePaise: number;
  agingSummary: {
    currentPaise: number;
    days1To30Paise: number;
    days31To60Paise: number;
    days61PlusPaise: number;
  };
}

export interface IReportRepository {
  getConfirmedQuotations(tenantId: string): Promise<QuotationSummary[]>;
  getDeliveries(tenantId: string): Promise<DeliverySummary[]>;
  getPayments(tenantId: string): Promise<PaymentSummary[]>;
}

