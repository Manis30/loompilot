import {
  ISupplierOrderRepository,
  SupplierOrder,
  SupplierOrderStatus,
} from "../interfaces/supplier-order.repository.js";
import { ISupplierRepository } from "../interfaces/supplier.repository.js";
import { IMaterialRepository } from "../interfaces/material.repository.js";
import { ICounterRepository } from "../interfaces/counter.repository.js";
import { IUnitOfWork } from "../interfaces/unit-of-work.js";
import { IAuditLogRepository } from "../interfaces/audit-log.js";
import { Actor } from "../utils/actor.js";
import { ListQuery, Page } from "../utils/pagination.js";
import {
  CreateSupplierOrderInput,
  UpdateSupplierOrderInput,
  ReceiveSupplierOrderInput,
} from "../validators/supplier-order.validator.js";
import {
  NotFoundError,
  BadRequestError,
  InvalidTransitionError,
} from "../errors/index.js";
import { StockMovementType } from "@loompilot/shared";

export class SupplierOrderService {
  constructor(
    private readonly repo: ISupplierOrderRepository,
    private readonly supplierRepo: ISupplierRepository,
    private readonly materialRepo: IMaterialRepository,
    private readonly counterRepo: ICounterRepository,
    private readonly uow: IUnitOfWork,
    private readonly audit?: IAuditLogRepository
  ) {}

  async create(actor: Actor, input: CreateSupplierOrderInput): Promise<SupplierOrder> {
    const supplier = await this.supplierRepo.findById(actor.tenantId, input.supplierId);
    if (!supplier) {
      throw new NotFoundError(`Supplier with ID ${input.supplierId} not found`);
    }

    return this.uow.run(async (tx) => {
      const orderNumber = await this.counterRepo.getNextDocumentNumber(
        actor.tenantId,
        "supplier_order",
        "PO",
        5,
        tx
      );

      // Verify materials
      for (const item of input.items) {
        const material = await this.materialRepo.findById(actor.tenantId, item.materialId, tx);
        if (!material) {
          throw new NotFoundError(`Material with ID ${item.materialId} not found`);
        }
      }

      const order = await this.repo.create(
        {
          tenantId: actor.tenantId,
          orderNumber,
          supplierId: input.supplierId,
          status: "draft",
          items: input.items.map((i) => ({
            materialId: i.materialId,
            quantity: i.quantity,
            unitCostPaise: i.unitCostPaise,
            receivedQty: 0,
          })),
          expectedDeliveryDate: input.expectedDeliveryDate,
          notes: input.notes,
        },
        tx
      );

      if (this.audit) {
        await this.audit.record(
          {
            tenantId: actor.tenantId,
            userId: actor.userId,
            userRole: actor.role,
            action: "SUPPLIER_ORDER_CREATED",
            entity: "supplier_order",
            entityId: order.id,
            changes: { orderNumber, supplierId: input.supplierId, itemsCount: input.items.length },
          },
          tx
        );
      }

      return order;
    });
  }

  async getById(actor: Actor, id: string): Promise<SupplierOrder> {
    const order = await this.repo.findById(actor.tenantId, id);
    if (!order) {
      throw new NotFoundError(`Supplier order with ID ${id} not found`);
    }
    return order;
  }

  async list(
    actor: Actor,
    query?: ListQuery & { supplierId?: string; status?: SupplierOrderStatus }
  ): Promise<Page<SupplierOrder>> {
    return this.repo.list(actor.tenantId, query);
  }

  async update(
    actor: Actor,
    id: string,
    input: UpdateSupplierOrderInput
  ): Promise<SupplierOrder> {
    const existing = await this.repo.findById(actor.tenantId, id);
    if (!existing) {
      throw new NotFoundError(`Supplier order with ID ${id} not found`);
    }

    // Only draft orders can have items or supplier changed
    if (existing.status !== "draft") {
      if (input.items || input.supplierId) {
        throw new BadRequestError("Cannot modify items or supplier of an order that is not in draft status");
      }
    }

    const updatePayload: Partial<SupplierOrder> = {
      notes: input.notes ?? existing.notes,
      expectedDeliveryDate: input.expectedDeliveryDate ?? existing.expectedDeliveryDate,
    };

    if (input.status) {
      updatePayload.status = input.status;
      if (input.status === "placed" && !existing.placedAt) {
        updatePayload.placedAt = new Date();
      }
    }

    if (existing.status === "draft") {
      if (input.supplierId) {
        const supplier = await this.supplierRepo.findById(actor.tenantId, input.supplierId);
        if (!supplier) {
          throw new NotFoundError(`Supplier with ID ${input.supplierId} not found`);
        }
        updatePayload.supplierId = input.supplierId;
      }
      if (input.items) {
        updatePayload.items = input.items.map((i) => ({
          materialId: i.materialId,
          quantity: i.quantity,
          unitCostPaise: i.unitCostPaise,
          receivedQty: 0,
        }));
      }
    }

    const updated = await this.repo.update(actor.tenantId, id, updatePayload);

    if (this.audit) {
      await this.audit.record({
        tenantId: actor.tenantId,
        userId: actor.userId,
        userRole: actor.role,
        action: "SUPPLIER_ORDER_UPDATED",
        entity: "supplier_order",
        entityId: id,
        changes: { before: existing, after: updated },
      });
    }

    return updated!;
  }

  async receive(
    actor: Actor,
    id: string,
    input: ReceiveSupplierOrderInput
  ): Promise<SupplierOrder> {
    return this.uow.run(async (tx) => {
      const order = await this.repo.findById(actor.tenantId, id, tx);
      if (!order) {
        throw new NotFoundError(`Supplier order with ID ${id} not found`);
      }

      if (order.status !== "placed" && order.status !== "partially_received") {
        throw new InvalidTransitionError(
          `Cannot receive items for order with status ${order.status}. Order must be placed or partially_received.`
        );
      }

      const updatedItems = order.items.map((item) => ({ ...item }));

      for (const received of input.items) {
        const poItem = updatedItems.find((i) => i.materialId === received.materialId);
        if (!poItem) {
          throw new BadRequestError(
            `Material ${received.materialId} is not in supplier order ${order.orderNumber}`
          );
        }

        poItem.receivedQty += received.quantity;
        const effectiveUnitCost = received.unitCostPaise ?? poItem.unitCostPaise;

        // Perform goods receipt against material in the same tx
        const material = await this.materialRepo.findById(actor.tenantId, received.materialId, tx);
        if (!material) {
          throw new NotFoundError(`Material ${received.materialId} not found`);
        }

        const oldOnHand = material.onHandQuantity;
        const oldAvgCost = material.avgCostPaise;
        const totalQty = oldOnHand + received.quantity;
        const newAvgCostPaise = Math.round(
          (oldOnHand * oldAvgCost + received.quantity * effectiveUnitCost) / totalQty
        );

        // Mutate stock atomically
        await this.materialRepo.mutateStock(
          actor.tenantId,
          material.id,
          received.quantity,
          0,
          tx
        );

        // Update weighted-average cost & current rate
        await this.materialRepo.update(
          actor.tenantId,
          material.id,
          {
            avgCostPaise: newAvgCostPaise,
            currentRatePaise: effectiveUnitCost,
          },
          tx
        );

        // Record stock movement
        await this.materialRepo.recordMovement(
          {
            tenantId: actor.tenantId,
            materialId: material.id,
            type: StockMovementType.RECEIPT,
            quantity: received.quantity,
            previousBalance: oldOnHand,
            newBalance: totalQty,
            referenceType: "receipt",
            referenceId: order.orderNumber,
            notes: input.notes || `Goods receipt from PO ${order.orderNumber}`,
          },
          tx
        );
      }

      const allReceived = updatedItems.every((i) => i.receivedQty >= i.quantity);
      const newStatus: SupplierOrderStatus = allReceived ? "received" : "partially_received";

      const updatedOrder = await this.repo.update(
        actor.tenantId,
        id,
        {
          items: updatedItems,
          status: newStatus,
        },
        tx
      );

      if (this.audit) {
        await this.audit.record(
          {
            tenantId: actor.tenantId,
            userId: actor.userId,
            userRole: actor.role,
            action: "SUPPLIER_ORDER_RECEIVED",
            entity: "supplier_order",
            entityId: id,
            changes: {
              receivedItems: input.items,
              newStatus,
            },
          },
          tx
        );
      }

      return updatedOrder!;
    });
  }
}
