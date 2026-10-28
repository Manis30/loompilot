import { MaterialType, StockMovementType } from "@loompilot/shared";
import { TxContext } from "./unit-of-work.js";
import { ListQuery, Page } from "../utils/pagination.js";

export interface Material {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  type: MaterialType;
  unit: string;
  currentRatePaise: number;
  avgCostPaise: number;
  onHandQuantity: number;
  reservedQuantity: number;
  reorderLevel: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewMaterial {
  tenantId: string;
  code: string;
  name: string;
  type: MaterialType;
  unit: string;
  currentRatePaise: number;
  avgCostPaise: number;
  onHandQuantity?: number;
  reservedQuantity?: number;
  reorderLevel?: number;
}

export interface StockMovement {
  id: string;
  tenantId: string;
  materialId: string;
  type: StockMovementType;
  quantity: number;
  previousBalance: number;
  newBalance: number;
  referenceType: "receipt" | "order_issue" | "reservation" | "adjustment";
  referenceId?: string;
  notes?: string;
  createdAt: Date;
}

export interface NewStockMovement {
  tenantId: string;
  materialId: string;
  type: StockMovementType;
  quantity: number;
  previousBalance: number;
  newBalance: number;
  referenceType: "receipt" | "order_issue" | "reservation" | "adjustment";
  referenceId?: string;
  notes?: string;
}

export interface Reservation {
  id: string;
  tenantId: string;
  materialId: string;
  orderId: string;
  quantity: number;
  status: "reserved" | "allocated" | "released";
  createdAt: Date;
  updatedAt: Date;
}

export interface NewReservation {
  tenantId: string;
  materialId: string;
  orderId: string;
  quantity: number;
  status?: "reserved" | "allocated" | "released";
}

export interface PriceHistory {
  id: string;
  tenantId: string;
  materialId: string;
  date: string;
  ratePaise: number;
  source: string;
  createdAt: Date;
}

export interface NewPriceHistory {
  tenantId: string;
  materialId: string;
  date: string;
  ratePaise: number;
  source?: string;
}

export interface IMaterialRepository {
  create(data: NewMaterial, tx?: TxContext): Promise<Material>;
  findById(tenantId: string, id: string, tx?: TxContext): Promise<Material | null>;
  findByCode(tenantId: string, code: string, tx?: TxContext): Promise<Material | null>;
  update(tenantId: string, id: string, data: Partial<Material>, tx?: TxContext): Promise<Material | null>;
  list(tenantId: string, query?: ListQuery): Promise<Page<Material>>;
  recordMovement(data: NewStockMovement, tx?: TxContext): Promise<StockMovement>;
  getMovements(tenantId: string, materialId: string): Promise<StockMovement[]>;
  createReservation(data: NewReservation, tx?: TxContext): Promise<Reservation>;
  findReservation(tenantId: string, orderId: string, materialId: string, tx?: TxContext): Promise<Reservation | null>;
  updateReservationStatus(tenantId: string, id: string, status: "reserved" | "allocated" | "released", tx?: TxContext): Promise<void>;
  recordPrice(data: NewPriceHistory, tx?: TxContext): Promise<PriceHistory>;
  getPriceHistory(tenantId: string, materialId: string, limitDays?: number): Promise<PriceHistory[]>;
}
