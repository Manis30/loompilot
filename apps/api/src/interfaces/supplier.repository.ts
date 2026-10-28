import { TxContext } from "./unit-of-work.js";
import { ListQuery, Page } from "../utils/pagination.js";

export interface Supplier {
  id: string;
  tenantId: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  leadTimeDays: number;
  rating: number;
  suppliedMaterials: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface NewSupplier {
  tenantId: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  leadTimeDays?: number;
  rating?: number;
  suppliedMaterials?: string[];
}

export interface ISupplierRepository {
  create(data: NewSupplier, tx?: TxContext): Promise<Supplier>;
  findById(tenantId: string, id: string, tx?: TxContext): Promise<Supplier | null>;
  list(tenantId: string, query?: ListQuery): Promise<Page<Supplier>>;
}

