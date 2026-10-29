import { OrderStatus, ProcessName } from "@loompilot/shared";
import { TxContext } from "./unit-of-work.js";
import { ListQuery, Page } from "../utils/pagination.js";

export interface ProcessPlanStep {
  processId: string;
  processName: ProcessName;
  sequence: number;
  targetQty: number;
  dailyTarget: number;
  startDate: string;
  endDate: string;
  completedQty: number;
}

export interface ProductionOrder {
  id: string;
  tenantId: string;
  quotationId: string;
  customerId: string;
  orderNumber: string;
  productName: string;
  totalQuantity: number;
  unit: string;
  status: OrderStatus;
  startDate: string;
  targetDeliveryDate: string;
  actualDeliveryDate?: string;
  materialCostActualPaise?: number;
  plan: ProcessPlanStep[];
  version?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewProductionOrder {
  tenantId: string;
  quotationId: string;
  customerId: string;
  orderNumber?: string;
  productName: string;
  totalQuantity: number;
  unit?: string;
  status?: OrderStatus;
  startDate: string;
  targetDeliveryDate: string;
  plan: ProcessPlanStep[];
}

export interface OrderVarianceItem {
  processName: ProcessName;
  targetDate: string;
  plannedQty: number;
  actualQty: number;
  deficitQty: number;
  isBehind: boolean;
}

export interface OrderVarianceReport {
  orderId: string;
  orderNumber: string;
  totalQuantity: number;
  status: OrderStatus;
  varianceData: OrderVarianceItem[];
}

export interface IOrderRepository {
  create(data: NewProductionOrder, tx?: TxContext): Promise<ProductionOrder>;
  findById(tenantId: string, id: string, tx?: TxContext): Promise<ProductionOrder | null>;
  findByOrderNumber(tenantId: string, orderNumber: string, tx?: TxContext): Promise<ProductionOrder | null>;
  updateStatus(
    tenantId: string,
    id: string,
    status: OrderStatus,
    actualDeliveryDate?: string,
    tx?: TxContext
  ): Promise<ProductionOrder | null>;
  addMaterialCost(
    tenantId: string,
    id: string,
    amountPaise: number,
    tx?: TxContext
  ): Promise<ProductionOrder | null>;
  list(tenantId: string, query?: ListQuery): Promise<Page<ProductionOrder>>;
  count(tenantId: string, tx?: TxContext): Promise<number>;
}

