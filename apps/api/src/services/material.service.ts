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
import { CreateMaterialInput, RecordMovementInput } from "../validators/material.validator.js";
import { NotFoundError, BadRequestError } from "../errors/index.js";
import { StockMovementType } from "@loompilot/shared";

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
    });

    if (this.audit) {
      await this.audit.record({
        tenantId: actor.tenantId,
        userId: actor.userId,
        userRole: actor.role,
        action: "MATERIAL_CREATED",
        entity: "material",
        entityId: material.id,
        changes: { code: material.code, name: material.name },
      });
    }

    return material;
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
      let newBalance = previousBalance;
      let newReserved = material.reservedQuantity;

      switch (input.type) {
        case StockMovementType.RECEIPT:
          newBalance = previousBalance + input.quantity;
          break;
        case StockMovementType.ISSUE:
          if (previousBalance < input.quantity) {
            throw new BadRequestError(
              `Insufficient stock: available ${previousBalance}, requested ${input.quantity}`
            );
          }
          newBalance = previousBalance - input.quantity;
          break;
        case StockMovementType.RESERVATION:
          newReserved = newReserved + input.quantity;
          break;
        case StockMovementType.RELEASE:
          newReserved = Math.max(0, newReserved - input.quantity);
          break;
        case StockMovementType.ADJUSTMENT:
          newBalance = input.quantity;
          break;
      }

      await this.repo.update(
        actor.tenantId,
        material.id,
        { onHandQuantity: newBalance, reservedQuantity: newReserved },
        tx
      );

      const movement = await this.repo.recordMovement(
        {
          tenantId: actor.tenantId,
          materialId: material.id,
          type: input.type,
          quantity: input.quantity,
          previousBalance,
          newBalance,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          notes: input.notes,
        },
        tx
      );

      if (this.audit) {
        await this.audit.record({
          tenantId: actor.tenantId,
          userId: actor.userId,
          userRole: actor.role,
          action: "STOCK_MOVEMENT_RECORDED",
          entity: "material",
          entityId: material.id,
          changes: { type: input.type, quantity: input.quantity, newBalance },
        });
      }

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
