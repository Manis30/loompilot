import { TxContext } from "./unit-of-work.js";
import { ListQuery, Page } from "../utils/pagination.js";

export interface Customer {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  contactPerson: string;
  email: string;
  phone: string;
  address?: string;
  creditPeriodDays: number;
  gstin?: string;
  preferredChannel: "whatsapp" | "email" | "sms";
  notes?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewCustomer {
  tenantId: string;
  name: string;
  code?: string;
  contactPerson: string;
  email: string;
  phone: string;
  address?: string;
  creditPeriodDays?: number;
  gstin?: string;
  preferredChannel?: "whatsapp" | "email" | "sms";
  notes?: string;
  active?: boolean;
}

export interface ICustomerRepository {
  create(data: NewCustomer, tx?: TxContext): Promise<Customer>;
  findById(tenantId: string, id: string): Promise<Customer | null>;
  findByCode(tenantId: string, code: string, tx?: TxContext): Promise<Customer | null>;
  findByEmail(tenantId: string, email: string): Promise<Customer | null>;
  list(tenantId: string, query?: ListQuery): Promise<Page<Customer>>;
  count(tenantId: string): Promise<number>;
  update(tenantId: string, id: string, data: Partial<Customer>, tx?: TxContext): Promise<Customer | null>;
}

