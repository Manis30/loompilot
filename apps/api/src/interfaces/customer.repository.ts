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
}

export interface ICustomerRepository {
  create(data: NewCustomer, tx?: TxContext): Promise<Customer>;
  findById(tenantId: string, id: string): Promise<Customer | null>;
  findByCode(tenantId: string, code: string): Promise<Customer | null>;
  list(tenantId: string, query?: ListQuery): Promise<Page<Customer>>;
  count(tenantId: string): Promise<number>;
}
