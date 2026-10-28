import { QuotationStatus } from "@loompilot/shared";
import { TxContext } from "./unit-of-work.js";
import { ListQuery, Page } from "../utils/pagination.js";

export interface QuotationLineItem {
  materialId: string;
  materialName: string;
  requiredQty: number;
  unit: string;
  onHandQty: number;
  reservedQty: number;
  toPurchaseQty: number;
  unitCostPaise: number;
  totalCostPaise: number;
  supplierLeadDays: number;
}

export interface Quotation {
  id: string;
  tenantId: string;
  enquiryId: string;
  customerId: string;
  quotationNumber: string;
  lineItems: QuotationLineItem[];
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
  status: QuotationStatus;
  explanation: string;
  assumptions: string[];
  inputsSnapshot: Record<string, any>;
  generationError?: string;
  approvedBy?: string;
  approvedAt?: Date;
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewQuotation {
  tenantId: string;
  enquiryId: string;
  customerId: string;
  quotationNumber?: string;
  lineItems: QuotationLineItem[];
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
  status?: QuotationStatus;
  explanation?: string;
  assumptions?: string[];
  inputsSnapshot?: Record<string, any>;
  generationError?: string;
}

export interface IQuotationRepository {
  create(data: NewQuotation, tx?: TxContext): Promise<Quotation>;
  findById(tenantId: string, id: string, tx?: TxContext): Promise<Quotation | null>;
  findByQuotationNumber(tenantId: string, quotationNumber: string, tx?: TxContext): Promise<Quotation | null>;
  update(tenantId: string, id: string, data: Partial<Quotation>, tx?: TxContext): Promise<Quotation | null>;
  list(tenantId: string, query?: ListQuery): Promise<Page<Quotation>>;
  count(tenantId: string, tx?: TxContext): Promise<number>;
}
