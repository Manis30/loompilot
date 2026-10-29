import { TxContext } from "./unit-of-work.js";
import { ListQuery, Page } from "../utils/pagination.js";

export type SupplierOrderStatus =
  | "draft"
  | "placed"
  | "partially_received"
  | "received"
  | "cancelled";

export interface SupplierOrderItem {
  materialId: string;
  quantity: number;
  unitCostPaise: number;
  receivedQty: number;
}

export interface SupplierOrder {
  id: string;
  tenantId: string;
  orderNumber: string;
  supplierId: string;
  status: SupplierOrderStatus;
  items: SupplierOrderItem[];
  expectedDeliveryDate?: string;
  placedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewSupplierOrder {
  tenantId: string;
  orderNumber: string;
  supplierId: string;
  status?: SupplierOrderStatus;
  items: SupplierOrderItem[];
  expectedDeliveryDate?: string;
  placedAt?: Date;
  notes?: string;
}

export interface ISupplierOrderRepository {
  create(data: NewSupplierOrder, tx?: TxContext): Promise<SupplierOrder>;
  findById(tenantId: string, id: string, tx?: TxContext): Promise<SupplierOrder | null>;
  findByOrderNumber(
    tenantId: string,
    orderNumber: string,
    tx?: TxContext
  ): Promise<SupplierOrder | null>;
  update(
    tenantId: string,
    id: string,
    data: Partial<SupplierOrder>,
    tx?: TxContext
  ): Promise<SupplierOrder | null>;
  list(
    tenantId: string,
    query?: ListQuery & { supplierId?: string; status?: SupplierOrderStatus }
  ): Promise<Page<SupplierOrder>>;
}

