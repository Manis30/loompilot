import { MaterialRepository } from "../repositories/material.repository.js";
import { StockMovementRepository } from "../repositories/stock-movement.repository.js";
import { SupplierRepository } from "../repositories/supplier.repository.js";
import { OrdersRepository } from "../repositories/orders.repository.js";
import { IUnitOfWork } from "../interfaces/unit-of-work.interface.js";
import { MongoUnitOfWork } from "../repositories/unit-of-work.js";
import { AuditService } from "./audit.service.js";
import { PaginationQuery } from "../utils/pagination.js";
import { AppError } from "../errors/app-error.js";
import { ErrorCode } from "@loompilot/shared";
import { toSupervisorMaterialDto } from "./material.service.js";

export class StockService {
  constructor(
    private readonly materialRepo = new MaterialRepository(),
    private readonly stockMovementRepo = new StockMovementRepository(),
    private readonly supplierRepo = new SupplierRepository(),
    private readonly ordersRepo = new OrdersRepository(),
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

    if (orderId && purchaseDecisionId) {
      const order = await this.ordersRepo.findById(tenantId, orderId);
      if (!order) {
        throw new AppError(ErrorCode.NOT_FOUND, `Order '${orderId}' not found`, 404);
      }
      const decision = order.purchaseDecisions?.find((d: any) => d.decisionId === purchaseDecisionId);
      if (!decision) {
        throw new AppError(ErrorCode.NOT_FOUND, `Purchase decision '${purchaseDecisionId}' not found on order`, 404);
      }
      if (String(decision.materialId) !== String(materialId)) {
        throw new AppError(ErrorCode.VALIDATION_FAILED, "Material does not match purchase decision", 400);
      }
      if (decision.supplierId && String(decision.supplierId) !== String(supplierId)) {
        throw new AppError(ErrorCode.VALIDATION_FAILED, "Supplier does not match purchase decision", 400);
      }
      if (decision.supplierOrder?.status === "cancelled") {
        throw new AppError(ErrorCode.VALIDATION_FAILED, "Cannot receive goods against a cancelled purchase decision", 400);
      }
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

      // 3. Atomically update supplierOrder status, recvQty and recvAt if linked to order purchase decision
      if (orderId && purchaseDecisionId) {
        await this.ordersRepo.updatePurchaseDecisionReceipt(
          tenantId,
          orderId,
          purchaseDecisionId,
          qty,
          tx
        );
      }

      // 4. Audit
      await this.auditService.log({
        tenantId,
        actor: { id: actor.id, type: "user", email: actor.email },
        action: "STOCK_GOODS_RECEIPT",
        entity: { collection: "stockMovements", id: String(movement._id) },
        after: { materialId, qty, qtyAfter: updated.stockQty, supplierId, unitCostPaise, orderId, purchaseDecisionId },
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

  async consumeStock(params: {
    tenantId: string;
    materialId: string;
    qty: number;
    orderId: string;
    reason?: string;
    actor: { id: string; email?: string; ip?: string; requestId?: string; role?: string };
  }) {
    const { tenantId, materialId, qty, orderId, reason, actor } = params;

    if (qty <= 0) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, "Consumption quantity must be greater than zero", 400);
    }

    const material = await this.materialRepo.findById(tenantId, materialId);
    if (!material) {
      throw new AppError(ErrorCode.NOT_FOUND, `Material '${materialId}' not found`, 404);
    }

    const order = await this.ordersRepo.findById(tenantId, orderId);
    if (!order) {
      throw new AppError(ErrorCode.NOT_FOUND, `Order '${orderId}' not found`, 404);
    }

    if (!["assigned", "in_production"].includes(order.status)) {
      throw new AppError(
        ErrorCode.VALIDATION_FAILED,
        `Cannot consume stock for order with status '${order.status}' (must be 'assigned' or 'in_production')`,
        400
      );
    }

    const hasActiveReservation = (order.reservations || []).some(
      (r: any) => String(r.materialId) === String(materialId) && r.status === "active"
    );

    return this.unitOfWork.withTransaction(async (tx) => {
      const updated = await this.materialRepo.consumeStock(tenantId, materialId, qty, hasActiveReservation, tx);
      if (!updated) {
        throw new AppError(
          ErrorCode.VALIDATION_FAILED,
          hasActiveReservation
            ? `Insufficient reserved stock to consume ${qty} units of material`
            : `Insufficient available (unreserved) stock to consume ${qty} units of material`,
          400
        );
      }

      if (hasActiveReservation) {
        await this.ordersRepo.consumeReservation(tenantId, orderId, materialId, qty, tx);
      }

      const movement = await this.stockMovementRepo.recordMovement(
        tenantId,
        {
          materialId,
          type: "consume",
          qty,
          qtyAfter: updated.stockQty,
          orderId,
        },
        tx
      );

      await this.auditService.log({
        tenantId,
        actor: { id: actor.id, type: "user", email: actor.email },
        action: "STOCK_CONSUMED",
        entity: { collection: "stockMovements", id: String(movement._id) },
        after: {
          materialId,
          qty,
          qtyAfter: updated.stockQty,
          reservedQtyAfter: updated.reservedQty,
          orderId,
          reason,
          fromReserved: hasActiveReservation,
        },
        ip: actor.ip,
        requestId: actor.requestId,
      });

      return {
        materialId,
        materialName: updated.materialName,
        stockQty: updated.stockQty,
        reservedQty: updated.reservedQty,
        available: Math.max(0, updated.stockQty - updated.reservedQty),
        movementId: String(movement._id),
      };
    });
  }

  async getStockBalances(tenantId: string, pagination: PaginationQuery, actorRole?: string) {
    const paginated = await this.materialRepo.findPaginated(tenantId, {}, pagination);

    if (actorRole === "supervisor") {
      return {
        data: paginated.data.map(toSupervisorMaterialDto),
        meta: paginated.meta,
      };
    }

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

  async listMovements(
    tenantId: string,
    pagination: PaginationQuery,
    filter?: { materialId?: string; type?: string; orderId?: string } | string
  ) {
    return this.stockMovementRepo.findMovementsPaginated(tenantId, pagination, filter);
  }

  async getStockSummary(tenantId: string, actor: { role?: string }) {
    const [materialSummary, procurementSummary] = await Promise.all([
      this.materialRepo.getStockSummary(tenantId),
      this.ordersRepo.getProcurementSummary(tenantId),
    ]);

    const isSupervisor = actor.role === "supervisor";

    return {
      totalMaterials: materialSummary.totalMaterials,
      lowStockCount: materialSummary.lowStockCount,
      byGroup: materialSummary.byGroup,
      procurement: procurementSummary,
      ...(isSupervisor ? {} : { totalValuationPaise: materialSummary.totalValuationPaise }),
    };
  }
}
