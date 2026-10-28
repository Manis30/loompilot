import { TxContext } from "./unit-of-work.js";
import { ListQuery, Page } from "../utils/pagination.js";

export interface EnquiryItemRequirement {
  productName: string;
  quantity: number;
  unit: string;
  targetDeliveryDate?: string;
  specialInstructions?: string;
}

export interface Enquiry {
  id: string;
  tenantId: string;
  enquiryNumber: string;
  customerId: string;
  customerName: string;
  rawText: string;
  parsedRequirements?: EnquiryItemRequirement;
  status: "new" | "processing" | "quoted" | "closed";
  createdAt: Date;
  updatedAt: Date;
}

export interface NewEnquiry {
  tenantId: string;
  enquiryNumber?: string;
  customerId: string;
  customerName: string;
  rawText: string;
  parsedRequirements?: EnquiryItemRequirement;
  status?: "new" | "processing" | "quoted" | "closed";
}

export interface IEnquiryRepository {
  create(data: NewEnquiry, tx?: TxContext): Promise<Enquiry>;
  findById(tenantId: string, id: string): Promise<Enquiry | null>;
  findByNumber(tenantId: string, enquiryNumber: string): Promise<Enquiry | null>;
  list(tenantId: string, query?: ListQuery): Promise<Page<Enquiry>>;
  count(tenantId: string): Promise<number>;
  updateStatus(tenantId: string, id: string, status: Enquiry["status"], tx?: TxContext): Promise<Enquiry | null>;
}
