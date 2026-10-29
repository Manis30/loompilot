import {
  IOrderRepository,
  ProductionOrder,
  OrderVarianceReport,
} from "../interfaces/order.repository.js";
import { IWorkforceRepository } from "../interfaces/workforce.repository.js";
import { IMaterialRepository } from "../interfaces/material.repository.js";
import { IProcessRepository } from "../interfaces/process.repository.js";
import { IQuotationRepository } from "../interfaces/quotation.repository.js";
import { IUnitOfWork } from "../interfaces/unit-of-work.js";
import { IAuditLogRepository } from "../interfaces/audit-log.js";
import { Actor } from "../utils/actor.js";
import { ListQuery, Page } from "../utils/pagination.js";
import { NotFoundError } from "../errors/index.js";
import { StockMovementType } from "@loompilot/shared";
import { IssueMaterialsInput } from "../validators/order.validator.js";

export interface OrderCostReport {
  orderId: string;
  orderNumber: string;
  actualMaterialCostPaise: number;
  actualLabourCostPaise: number;
  actualProcessCostPaise: number;
  totalActualCostPaise: number;
  quotedMaterialCostPaise: number | null;
  quotedLabourCostPaise: number | null;
  quotedTotalCostPaise: number | null;
  variancePaise: number | null;
}

export class OrderService {
  constructor(
    private readonly repo: IOrderRepository,
    private readonly workforceRepo: IWorkforceRepository,
    private readonly uow: IUnitOfWork,
    private readonly audit?: IAuditLogRepository,
    private readonly materialRepo?: IMaterialRepository,
    private readonly processRepo?: IProcessRepository,
    private readonly quotationRepo?: IQuotationRepository
  ) { }

  async list(actor: Actor, query?: ListQuery): Promise<Page<ProductionOrder>> {
    return this.repo.list(actor.tenantId, query);
  }

  async getById(actor: Actor, id: string): Promise<ProductionOrder> {
    const order = await this.repo.findById(actor.tenantId, id);
    if (!order) {
      throw new NotFoundError(`Order with ID ${id} not found`);
    }
    return order;
  }

  async issueMaterials(
    actor: Actor,
    orderId: string,
    input: IssueMaterialsInput
  ): Promise<{
    orderId: string;
    issuedItems: Array<{
      materialId: string;
      quantity: number;
      unitCostPaise: number;
      lineTotalPaise: number;
    }>;
    totalMaterialCostPaise: number;
    currentOrderMaterialCostPaise: number;
  }> {
    if (!this.materialRepo) {
      throw new Error("Material repository not injected into OrderService");
    }

    const order = await this.repo.findById(actor.tenantId, orderId);
    if (!order) {
      throw new NotFoundError(`Order with ID ${orderId} not found`);
    }

    return this.uow.run(async (tx) => {
      let totalMaterialCostPaise = 0;
      const issuedItems: Array<{
        materialId: string;
        quantity: number;
        unitCostPaise: number;
        lineTotalPaise: number;
      }> = [];

      for (const item of input.items) {
        const material = await this.materialRepo!.findById(actor.tenantId, item.materialId, tx);
        if (!material) {
          throw new NotFoundError(`Material with ID ${item.materialId} not found`);
        }

        // Reservation model: onHand -= qty and reserved -= qty (up to current reservedQuantity)
        const reservedToDeduct = Math.min(material.reservedQuantity, item.quantity);
        const updatedMaterial = await this.materialRepo!.mutateStock(
          actor.tenantId,
          item.materialId,
          -item.quantity,
          -reservedToDeduct,
          tx
        );

        const unitCostPaise = material.avgCostPaise || material.currentRatePaise;
        const lineTotalPaise = Math.round(item.quantity * unitCostPaise);
        totalMaterialCostPaise += lineTotalPaise;

        await this.materialRepo!.recordMovement(
          {
            tenantId: actor.tenantId,
            materialId: item.materialId,
            type: StockMovementType.ISSUE,
            quantity: -item.quantity,
            previousBalance: material.onHandQuantity,
            newBalance: updatedMaterial.onHandQuantity,
            referenceType: "order_issue",
            referenceId: orderId,
            notes: input.notes || `Issued to order ${order.orderNumber}`,
          },
          tx
        );

        issuedItems.push({
          materialId: item.materialId,
          quantity: item.quantity,
          unitCostPaise,
          lineTotalPaise,
        });
      }

      const updatedOrder = await this.repo.addMaterialCost(
        actor.tenantId,
        orderId,
        totalMaterialCostPaise,
        tx
      );

      if (this.audit) {
        await this.audit.record(
          {
            tenantId: actor.tenantId,
            userId: actor.userId,
            userRole: actor.role,
            action: "ORDER_MATERIALS_ISSUED",
            entity: "production_order",
            entityId: orderId,
            changes: {
              issuedItems,
              totalMaterialCostPaise,
              currentMaterialCostPaise: updatedOrder?.materialCostActualPaise,
            },
          },
          tx
        );
      }

      return {
        orderId,
        issuedItems,
        totalMaterialCostPaise,
        currentOrderMaterialCostPaise: updatedOrder?.materialCostActualPaise || 0,
      };
    });
  }

  async getOrderCosts(actor: Actor, orderId: string): Promise<OrderCostReport> {
    const order = await this.repo.findById(actor.tenantId, orderId);
    if (!order) {
      throw new NotFoundError(`Order with ID ${orderId} not found`);
    }

    // 1. Actual Material Cost from order.materialCostActualPaise
    const actualMaterialCostPaise = order.materialCostActualPaise || 0;

    // 2. Actual Labour Cost from Daily Outputs
    const outputs = await this.workforceRepo.getOutputsForOrder(actor.tenantId, orderId);
    const actualLabourCostPaise = outputs.reduce(
      (sum, out) => sum + (out.labourCostPaise || 0),
      0
    );

    // 3. Actual Process Cost from Process unit costs * quantities produced
    let actualProcessCostPaise = 0;
    if (this.processRepo) {
      const processes = await this.processRepo.listAllOrdered(actor.tenantId);
      const processMap = new Map<string, number>();
      for (const p of processes) {
        processMap.set(p.id, p.costPerUnitPaise || 0);
      }
      for (const out of outputs) {
        const unitCost = processMap.get(out.processId) || 0;
        actualProcessCostPaise += Math.round(out.quantityProduced * unitCost);
      }
    }

    const totalActualCostPaise =
      actualMaterialCostPaise + actualLabourCostPaise + actualProcessCostPaise;

    // 4. Quoted costs from linked quotation
    let quotedMaterialCostPaise: number | null = null;
    let quotedLabourCostPaise: number | null = null;
    let quotedTotalCostPaise: number | null = null;
    let variancePaise: number | null = null;

    if (order.quotationId && this.quotationRepo) {
      const quotation = await this.quotationRepo.findById(actor.tenantId, order.quotationId);
      if (quotation) {
        quotedMaterialCostPaise = quotation.materialCostPaise;
        quotedLabourCostPaise = quotation.processingCostPaise;
        quotedTotalCostPaise = quotation.subtotalCostPaise || quotation.finalPricePaise;
        variancePaise = totalActualCostPaise - quotedTotalCostPaise;
      }
    }

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      actualMaterialCostPaise,
      actualLabourCostPaise,
      actualProcessCostPaise,
      totalActualCostPaise,
      quotedMaterialCostPaise,
      quotedLabourCostPaise,
      quotedTotalCostPaise,
      variancePaise,
    };
  }

  async getVariance(actor: Actor, orderId: string): Promise<OrderVarianceReport> {
    const order = await this.repo.findById(actor.tenantId, orderId);
    if (!order) {
      throw new NotFoundError(`Order with ID ${orderId} not found`);
    }

    const outputs = await this.workforceRepo.getOutputsForOrder(actor.tenantId, orderId);

    // Aggregate cumulative actual by date
    let cumulativeActual = 0;
    const outputMap = new Map<string, number>();

    for (const out of outputs) {
      cumulativeActual += out.quantityProduced;
      outputMap.set(out.date, cumulativeActual);
    }

    // Build timeline points from plan
    const varianceData = order.plan.map((step) => {
      const actualCumulative = outputMap.get(step.endDate) ?? cumulativeActual;
      const plannedTarget = step.targetQty;
      const deficit = Math.max(0, plannedTarget - actualCumulative);

      return {
        processName: step.processName,
        targetDate: step.endDate,
        plannedQty: plannedTarget,
        actualQty: actualCumulative,
        deficitQty: deficit,
        isBehind: actualCumulative < plannedTarget,
      };
    });

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      totalQuantity: order.totalQuantity,
      status: order.status,
      varianceData,
    };
  }
}
