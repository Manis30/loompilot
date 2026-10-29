import {
  IMaterialRepository,
  Material,
  StockMovement,
  PriceHistory,
} from "../interfaces/material.repository.js";
import { IUnitOfWork } from "../interfaces/unit-of-work.js";
import { IAuditLogRepository } from "../interfaces/audit-log.js";
import { Actor } from "../utils/actor.js";
import { ListQuery, Page } from "../utils/pagination.js";
import {
  CreateMaterialInput,
  UpdateMaterialInput,
  RecordMovementInput,
  UpdateRateInput,
  BackfillPriceHistoryInput,
  GoodsReceiptInput,
  StockAdjustmentInput,
} from "../validators/material.validator.js";
import { NotFoundError } from "../errors/index.js";
import { StockMovementType } from "@loompilot/shared";
import { todayInTz } from "../utils/dates.js";

export class MaterialService {
  constructor(
    private readonly repo: IMaterialRepository,
    private readonly uow: IUnitOfWork,
    private readonly audit?: IAuditLogRepository
  ) {}

  async list(actor: Actor, query?: ListQuery): Promise<Page<Material>> {
    return this.repo.list(actor.tenantId, query);
  }

  async getById(actor: Actor, id: string): Promise<Material> {
    const material = await this.repo.findById(actor.tenantId, id);
    if (!material) {
      throw new NotFoundError(`Material with ID ${id} not found`);
    }
    return material;
  }

  async create(actor: Actor, input: CreateMaterialInput): Promise<Material> {
    const material = await this.repo.create({
      tenantId: actor.tenantId,
      code: input.code,
      name: input.name,
      type: input.type,
      unit: input.unit,
      currentRatePaise: input.currentRatePaise,
      avgCostPaise: input.avgCostPaise,
      onHandQuantity: input.onHandQuantity ?? 0,
      reservedQuantity: input.reservedQuantity ?? 0,
      reorderLevel: input.reorderLevel ?? 0,
      preferredSupplierId: input.preferredSupplierId,
      active: input.active ?? true,
    });

    if (this.audit) {
      await this.audit.record({
        tenantId: actor.tenantId,
        actorId: actor.userId,
        actorRole: actor.role,
        action: "MATERIAL_CREATED",
        entityType: "material",
        entityId: material.id,
        after: { code: material.code, name: material.name },
      });
    }

    return material;
  }

  async update(
    actor: Actor,
    id: string,
    updates: UpdateMaterialInput
  ): Promise<Material> {
    const existing = await this.repo.findById(actor.tenantId, id);
    if (!existing) {
      throw new NotFoundError(`Material with ID ${id} not found`);
    }

    const before = {
      name: existing.name,
      type: existing.type,
      unit: existing.unit,
      reorderLevel: existing.reorderLevel,
      preferredSupplierId: existing.preferredSupplierId,
      active: existing.active,
    };

    const updated = await this.repo.update(actor.tenantId, id, updates);
    if (!updated) {
      throw new NotFoundError(`Material with ID ${id} not found`);
    }

    if (this.audit) {
      await this.audit.record({
        tenantId: actor.tenantId,
        actorId: actor.userId,
        actorRole: actor.role,
        action: updates.active === false ? "MATERIAL_DEACTIVATED" : "MATERIAL_UPDATED",
        entityType: "material",
        entityId: id,
        before,
        after: {
          name: updated.name,
          type: updated.type,
          unit: updated.unit,
          reorderLevel: updated.reorderLevel,
          preferredSupplierId: updated.preferredSupplierId,
          active: updated.active,
        },
      });
    }

    return updated;
  }

  async updateRate(
    actor: Actor,
    id: string,
    input: UpdateRateInput
  ): Promise<Material> {
    const material = await this.repo.findById(actor.tenantId, id);
    if (!material) {
      throw new NotFoundError(`Material with ID ${id} not found`);
    }

    const effectiveDate = input.effectiveDate || todayInTz();

    return this.uow.run(async (tx) => {
      const updated = await this.repo.update(
        actor.tenantId,
        id,
        { currentRatePaise: input.ratePaise },
        tx
      );

      await this.repo.appendPriceHistory(
        actor.tenantId,
        id,
        effectiveDate,
        input.ratePaise,
        input.source || "manual",
        input.referenceId,
        tx
      );

      if (this.audit) {
        await this.audit.record(
          {
            tenantId: actor.tenantId,
            actorId: actor.userId,
            actorRole: actor.role,
            action: "MATERIAL_RATE_UPDATED",
            entityType: "material",
            entityId: id,
            before: { currentRatePaise: material.currentRatePaise },
            after: {
              currentRatePaise: input.ratePaise,
              effectiveDate,
              source: input.source,
            },
          },
          tx
        );
      }

      return updated!;
    });
  }

  async backfillPriceHistory(
    actor: Actor,
    id: string,
    input: BackfillPriceHistoryInput
  ): Promise<{ insertedCount: number }> {
    const material = await this.repo.findById(actor.tenantId, id);
    if (!material) {
      throw new NotFoundError(`Material with ID ${id} not found`);
    }

    const insertedCount = await this.repo.backfillPriceHistory(
      actor.tenantId,
      id,
      input.entries
    );

    return { insertedCount };
  }

  async goodsReceipt(
    actor: Actor,
    id: string,
    input: GoodsReceiptInput
  ): Promise<{ material: Material; movement: StockMovement }> {
    return this.uow.run(async (tx) => {
      const material = await this.repo.findById(actor.tenantId, id, tx);
      if (!material) {
        throw new NotFoundError(`Material with ID ${id} not found`);
      }

      const oldOnHand = material.onHandQuantity;
      const oldAvgCost = material.avgCostPaise;
      const receivedQty = input.receivedQty;
      const receivedCost = input.receivedCostPaise;

      // Weighted-average cost update formula:
      // ((oldOnHand * oldCost) + (receivedQty * receivedCost)) / (oldOnHand + receivedQty)
      const totalQuantity = oldOnHand + receivedQty;
      const newAvgCostPaise = Math.round(
        (oldOnHand * oldAvgCost + receivedQty * receivedCost) / totalQuantity
      );

      // Mutate stock atomically
      const updatedMaterial = await this.repo.mutateStock(
        actor.tenantId,
        id,
        receivedQty,
        0,
        tx
      );

      // Update weighted average cost and currentRatePaise
      await this.repo.update(
        actor.tenantId,
        id,
        {
          avgCostPaise: newAvgCostPaise,
          currentRatePaise: receivedCost,
        },
        tx
      );

      // Record stock movement
      const movement = await this.repo.recordMovement(
        {
          tenantId: actor.tenantId,
          materialId: id,
          type: StockMovementType.RECEIPT,
          quantity: receivedQty,
          previousBalance: oldOnHand,
          newBalance: oldOnHand + receivedQty,
          referenceType: "receipt",
          referenceId: input.referenceId,
          notes: input.notes,
        },
        tx
      );

      // Append to price history
      await this.repo.appendPriceHistory(
        actor.tenantId,
        id,
        todayInTz(),
        receivedCost,
        "po",
        input.referenceId,
        tx
      );

      if (this.audit) {
        await this.audit.record(
          {
            tenantId: actor.tenantId,
            actorId: actor.userId,
            actorRole: actor.role,
            action: "GOODS_RECEIPT_RECORDED",
            entityType: "material",
            entityId: id,
            before: { onHandQuantity: oldOnHand, avgCostPaise: oldAvgCost },
            after: {
              onHandQuantity: oldOnHand + receivedQty,
              avgCostPaise: newAvgCostPaise,
              receivedQty,
              receivedCostPaise: receivedCost,
            },
          },
          tx
        );
      }

      return {
        material: {
          ...updatedMaterial,
          avgCostPaise: newAvgCostPaise,
          currentRatePaise: receivedCost,
        },
        movement,
      };
    });
  }

  async stockAdjustment(
    actor: Actor,
    id: string,
    input: StockAdjustmentInput
  ): Promise<{ material: Material; movement: StockMovement }> {
    return this.uow.run(async (tx) => {
      const material = await this.repo.findById(actor.tenantId, id, tx);
      if (!material) {
        throw new NotFoundError(`Material with ID ${id} not found`);
      }

      const oldOnHand = material.onHandQuantity;
      const delta = input.newBalance - oldOnHand;

      const updated = await this.repo.mutateStock(
        actor.tenantId,
        id,
        delta,
        0,
        tx
      );

      const movement = await this.repo.recordMovement(
        {
          tenantId: actor.tenantId,
          materialId: id,
          type: StockMovementType.ADJUSTMENT,
          quantity: Math.abs(delta),
          previousBalance: oldOnHand,
          newBalance: input.newBalance,
          referenceType: "adjustment",
          notes: input.reason,
        },
        tx
      );

      if (this.audit) {
        await this.audit.record(
          {
            tenantId: actor.tenantId,
            actorId: actor.userId,
            actorRole: actor.role,
            action: "STOCK_ADJUSTMENT_RECORDED",
            entityType: "material",
            entityId: id,
            before: { onHandQuantity: oldOnHand },
            after: {
              onHandQuantity: input.newBalance,
              reason: input.reason,
            },
          },
          tx
        );
      }

      return { material: updated, movement };
    });
  }

  async getStockSummary(actor: Actor) {
    return this.repo.getStockSummary(actor.tenantId);
  }

  async recordMovement(
    actor: Actor,
    materialId: string,
    input: RecordMovementInput
  ): Promise<StockMovement> {
    return this.uow.run(async (tx) => {
      const material = await this.repo.findById(actor.tenantId, materialId, tx);
      if (!material) {
        throw new NotFoundError(`Material with ID ${materialId} not found`);
      }

      const previousBalance = material.onHandQuantity;
      let onHandChange = 0;
      let reservedChange = 0;

      switch (input.type) {
        case StockMovementType.RECEIPT:
          onHandChange = input.quantity;
          break;
        case StockMovementType.ISSUE:
          onHandChange = -input.quantity;
          break;
        case StockMovementType.RESERVATION:
          reservedChange = input.quantity;
          break;
        case StockMovementType.RELEASE:
          reservedChange = -input.quantity;
          break;
        case StockMovementType.ADJUSTMENT:
          onHandChange = input.quantity - previousBalance;
          break;
      }

      const updated = await this.repo.mutateStock(
        actor.tenantId,
        material.id,
        onHandChange,
        reservedChange,
        tx
      );

      const movement = await this.repo.recordMovement(
        {
          tenantId: actor.tenantId,
          materialId: material.id,
          type: input.type,
          quantity: input.quantity,
          previousBalance,
          newBalance: updated.onHandQuantity,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          notes: input.notes,
        },
        tx
      );

      return movement;
    });
  }

  async getMovements(actor: Actor, materialId: string): Promise<StockMovement[]> {
    return this.repo.getMovements(actor.tenantId, materialId);
  }

  async getPriceHistory(
    actor: Actor,
    materialId: string,
    limitDays = 90
  ): Promise<PriceHistory[]> {
    return this.repo.getPriceHistory(actor.tenantId, materialId, limitDays);
  }
}
