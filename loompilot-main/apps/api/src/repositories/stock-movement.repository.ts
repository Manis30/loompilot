import { Types } from "mongoose";
import { BaseRepository } from "./base.repository.js";
import { IStockMovement, StockMovementModel } from "../models/production/stock-movement.model.js";
import { PaginationQuery, PaginatedResult } from "../utils/pagination.js";
import { TxContext } from "../interfaces/unit-of-work.interface.js";

export class StockMovementRepository extends BaseRepository<IStockMovement> {
  constructor() {
    super(StockMovementModel);
  }

  async recordMovement(
    tenantId: string,
    data: {
      materialId: string;
      type: "receipt" | "consume" | "reserve" | "release" | "adjust" | "opening";
      qty: number;
      qtyAfter: number;
      orderId?: string;
      purchaseDecisionId?: string;
    },
    tx?: TxContext
  ): Promise<IStockMovement> {
    return this.create(
      tenantId,
      {
        materialId: new Types.ObjectId(data.materialId),
        type: data.type,
        qty: data.qty,
        qtyAfter: data.qtyAfter,
        orderId: data.orderId ? new Types.ObjectId(data.orderId) : undefined,
        purchaseDecisionRef:
          data.orderId && data.purchaseDecisionId
            ? {
                orderId: new Types.ObjectId(data.orderId),
                decisionId: data.purchaseDecisionId,
              }
            : undefined,
        version: 1,
      } as any,
      tx
    );
  }

  async findMovementsPaginated(
    tenantId: string,
    pagination: PaginationQuery,
    filterOrMaterialId?: string | { materialId?: string; type?: string; orderId?: string }
  ): Promise<PaginatedResult<IStockMovement>> {
    const filter: Record<string, any> = {};
    if (typeof filterOrMaterialId === "string") {
      filter.materialId = new Types.ObjectId(filterOrMaterialId);
    } else if (filterOrMaterialId) {
      if (filterOrMaterialId.materialId) {
        filter.materialId = new Types.ObjectId(filterOrMaterialId.materialId);
      }
      if (filterOrMaterialId.type) {
        filter.type = filterOrMaterialId.type;
      }
      if (filterOrMaterialId.orderId) {
        filter.orderId = new Types.ObjectId(filterOrMaterialId.orderId);
      }
    }
    return this.findPaginated(tenantId, filter, pagination);
  }
}
