import { MaterialRepository } from "../repositories/material.repository.js";
import { StockMovementRepository } from "../repositories/stock-movement.repository.js";
import { SupplierRepository } from "../repositories/supplier.repository.js";
import { IUnitOfWork } from "../interfaces/unit-of-work.interface.js";
import { MongoUnitOfWork } from "../repositories/unit-of-work.js";
import { AuditService } from "./audit.service.js";
import { PaginationQuery } from "../utils/pagination.js";
import { AppError } from "../errors/app-error.js";
import { ErrorCode } from "@loompilot/shared";

export class StockService {
  constructor(
    private readonly materialRepo = new MaterialRepository(),
    private readonly stockMovementRepo = new StockMovementRepository(),
    private readonly supplierRepo = new SupplierRepository(),
    private readonly unitOfWork: IUnitOfWork = new MongoUnitOfWork(),
    private readonly auditService = new AuditService()
  ) {}

  async recordGoodsReceipt(params: {
    tenantId: string;
    materialId: string;
    qty: number;
    unitCostPaise: number;
    supplierId: string;
    orderId?: string;
    purchaseDecisionId?: string;
    actor: { id: string; email?: string; ip?: string; requestId?: string };
  }) {
    const { tenantId, materialId, qty, unitCostPaise, supplierId, orderId, purchaseDecisionId, actor } = params;

    if (qty <= 0) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, "Goods receipt quantity must be greater than zero", 400);
    }

    const material = await this.materialRepo.findById(tenantId, materialId);
    if (!material) {
      throw new AppError(ErrorCode.NOT_FOUND, `Material '${materialId}' not found`, 404);
    }

    const supplier = await this.supplierRepo.findById(tenantId, supplierId);
    if (!supplier) {
      throw new AppError(ErrorCode.NOT_FOUND, `Supplier '${supplierId}' not found`, 404);
    }

    return this.unitOfWork.withTransaction(async (tx) => {
      // 1. Atomically increment stockQty
      const updated = await this.materialRepo.adjustStock(tenantId, materialId, qty, tx);
      if (!updated) {
        throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to update material stock level", 500);
      }

      // 2. Append receipt stock movement
      const movement = await this.stockMovementRepo.recordMovement(
        tenantId,
        {
          materialId,
          type: "receipt",
          qty,
          qtyAfter: updated.stockQty,
          orderId,
          purchaseDecisionId,
        },
        tx
      );

      // 3. Audit
      await this.auditService.log({
        tenantId,
        actor: { id: actor.id, type: "user", email: actor.email },
        action: "STOCK_GOODS_RECEIPT",
        entity: { collection: "stockMovements", id: String(movement._id) },
        after: { materialId, qty, qtyAfter: updated.stockQty, supplierId, unitCostPaise },
        ip: actor.ip,
        requestId: actor.requestId,
      });

      return {
        materialId,
        materialName: updated.materialName,
        stockQty: updated.stockQty,
        reservedQty: updated.reservedQty,
        available: updated.stockQty - updated.reservedQty,
        movementId: String(movement._id),
      };
    });
  }

  async adjustStock(params: {
    tenantId: string;
    materialId: string;
    deltaQty: number;
    reason: string;
    actor: { id: string; email?: string; ip?: string; requestId?: string };
  }) {
    const { tenantId, materialId, deltaQty, reason, actor } = params;

    if (!reason || reason.trim().length === 0) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, "Reason is strictly mandatory for stock adjustments", 400);
    }
    if (deltaQty === 0) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, "Adjustment delta cannot be zero", 400);
    }

    return this.unitOfWork.withTransaction(async (tx) => {
      const updated = await this.materialRepo.adjustStock(tenantId, materialId, deltaQty, tx);
      if (!updated) {
        throw new AppError(
          ErrorCode.VALIDATION_FAILED,
          "Insufficient stock quantity to fulfill negative stock adjustment",
          400
        );
      }

      // Ensure stockQty never falls below reservedQty
      if (updated.stockQty < updated.reservedQty) {
        throw new AppError(
          ErrorCode.VALIDATION_FAILED,
          `Stock adjustment would reduce available stock below active reservations (Stock: ${updated.stockQty}, Reserved: ${updated.reservedQty})`,
          400
        );
      }

      const movement = await this.stockMovementRepo.recordMovement(
        tenantId,
        {
          materialId,
          type: "adjust",
          qty: deltaQty,
          qtyAfter: updated.stockQty,
        },
        tx
      );

      await this.auditService.log({
        tenantId,
        actor: { id: actor.id, type: "user", email: actor.email },
        action: "STOCK_ADJUSTMENT",
        entity: { collection: "stockMovements", id: String(movement._id) },
        after: { materialId, deltaQty, qtyAfter: updated.stockQty, reason },
        ip: actor.ip,
        requestId: actor.requestId,
      });

      return {
        materialId,
        materialName: updated.materialName,
        stockQty: updated.stockQty,
        reservedQty: updated.reservedQty,
        available: updated.stockQty - updated.reservedQty,
        movementId: String(movement._id),
      };
    });
  }

  async getStockBalances(tenantId: string, pagination: PaginationQuery) {
    const paginated = await this.materialRepo.findPaginated(tenantId, {}, pagination);
    const items = paginated.data.map((m: any) => ({
      materialId: m._id,
      materialName: m.materialName,
      type: m.type,
      unit: m.unit,
      stockQty: m.stockQty,
      reservedQty: m.reservedQty,
      available: Math.max(0, m.stockQty - m.reservedQty),
      reorderLevel: m.reorderLevel,
      currentRatePaise: m.currentRatePaise,
    }));

    return {
      data: items,
      meta: paginated.meta,
    };
  }

  async listMovements(tenantId: string, pagination: PaginationQuery, materialId?: string) {
    return this.stockMovementRepo.findMovementsPaginated(tenantId, pagination, materialId);
  }
}
