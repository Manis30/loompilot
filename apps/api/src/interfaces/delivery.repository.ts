import { DeliveryStatus } from "@loompilot/shared";
import { TxContext } from "./unit-of-work.js";
import { ListQuery, Page } from "../utils/pagination.js";

export interface Delivery {
  id: string;
  tenantId: string;
  orderId: string;
  customerId: string;
  deliveryNumber: string;
  deliveredQuantity: number;
  deliveryDate: string;
  status: DeliveryStatus;
  isOnTime: boolean;
  invoiceNumber: string;
  totalInvoicePaise: number;
  receivedBy?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewDelivery {
  tenantId: string;
  orderId: string;
  customerId: string;
  deliveryNumber?: string;
  deliveredQuantity: number;
  deliveryDate: string;
  status?: DeliveryStatus;
  isOnTime: boolean;
  invoiceNumber?: string;
  totalInvoicePaise: number;
  receivedBy?: string;
  notes?: string;
}

export interface IDeliveryRepository {
  create(data: NewDelivery, tx?: TxContext): Promise<Delivery>;
  findById(tenantId: string, id: string, tx?: TxContext): Promise<Delivery | null>;
  findByDeliveryNumber(tenantId: string, deliveryNumber: string, tx?: TxContext): Promise<Delivery | null>;
  list(tenantId: string, query?: ListQuery): Promise<Page<Delivery>>;
  count(tenantId: string, tx?: TxContext): Promise<number>;
}
