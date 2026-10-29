import { TxContext } from "./unit-of-work.js";
import { ListQuery, Page } from "../utils/pagination.js";

export interface Supplier {
  id: string;
  tenantId: string;
  name: string;
  code?: string;
  contactPerson: string;
  email: string;
  phone: string;
  address?: string;
  gstin?: string;
  paymentTermsDays?: number;
  leadTimeDays: number;
  rating: number;
  suppliedMaterials: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewSupplier {
  tenantId: string;
  name: string;
  code?: string;
  contactPerson: string;
  email: string;
  phone: string;
  address?: string;
  gstin?: string;
  paymentTermsDays?: number;
  leadTimeDays?: number;
  rating?: number;
  suppliedMaterials?: string[];
  active?: boolean;
}

export interface ISupplierRepository {
  create(data: NewSupplier, tx?: TxContext): Promise<Supplier>;
  findById(tenantId: string, id: string, tx?: TxContext): Promise<Supplier | null>;
  findByCode(tenantId: string, code: string, tx?: TxContext): Promise<Supplier | null>;
  findByName(tenantId: string, name: string, tx?: TxContext): Promise<Supplier | null>;
  list(tenantId: string, query?: ListQuery): Promise<Page<Supplier>>;
  update(tenantId: string, id: string, data: Partial<Supplier>, tx?: TxContext): Promise<Supplier | null>;
}

