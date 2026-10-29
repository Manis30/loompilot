import { TxContext } from "./unit-of-work.js";

export interface Product {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  description?: string;
  unit: string;
  active: boolean;
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewProduct {
  tenantId: string;
  code: string;
  name: string;
  description?: string;
  unit: string;
  active?: boolean;
  category: string;
}

export interface BomItem {
  materialId: string;
  quantityPerUnit: number;
  unit: string;
  wastageAllowancePct: number;
}

export interface Bom {
  id: string;
  tenantId: string;
  productId: string;
  version: number;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  items: BomItem[];
  createdAt: Date;
}

export interface NewBom {
  tenantId: string;
  productId: string;
  items: BomItem[];
  effectiveFrom?: Date;
}

export interface IProductRepository {
  list(tenantId: string, filter?: { activeOnly?: boolean; category?: string }): Promise<Product[]>;
  findById(tenantId: string, id: string): Promise<Product | null>;
  findByCode(tenantId: string, code: string): Promise<Product | null>;
  create(data: NewProduct, tx?: TxContext): Promise<Product>;
  update(tenantId: string, id: string, data: Partial<Product>, tx?: TxContext): Promise<Product | null>;

  getActiveBom(tenantId: string, productId: string): Promise<Bom | null>;
  listBoms(tenantId: string, productId: string): Promise<Bom[]>;
  createBomVersion(data: NewBom, tx?: TxContext): Promise<Bom>;
}
