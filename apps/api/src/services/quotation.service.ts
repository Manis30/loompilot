import {
  IQuotationRepository,
  Quotation,
} from "../interfaces/quotation.repository.js";
import { ICustomerRepository } from "../interfaces/customer.repository.js";
import { IMaterialRepository } from "../interfaces/material.repository.js";
import { IProcessRepository } from "../interfaces/process.repository.js";
import { IOrderRepository, ProductionOrder, ProcessPlanStep } from "../interfaces/order.repository.js";
import { IPdfRenderer, QuotationPdfData } from "../interfaces/pdf-renderer.js";
import { IUnitOfWork } from "../interfaces/unit-of-work.js";
import { IAuditLogRepository } from "../interfaces/audit-log.js";
import { Actor } from "../utils/actor.js";
import { ListQuery, Page } from "../utils/pagination.js";
import { CreateQuotationDraftInput } from "../validators/quotation.validator.js";
import { NotFoundError, BadRequestError } from "../errors/index.js";
import { QuotationStatus, OrderStatus, StockMovementType } from "@loompilot/shared";

export class QuotationService {
  constructor(
    private readonly quoteRepo: IQuotationRepository,
    private readonly customerRepo: ICustomerRepository,
    private readonly materialRepo: IMaterialRepository,
    private readonly processRepo: IProcessRepository,
    private readonly orderRepo: IOrderRepository,
    private readonly pdfRenderer: IPdfRenderer,
    private readonly uow: IUnitOfWork,
    private readonly audit?: IAuditLogRepository
  ) {}

  async list(actor: Actor, query?: ListQuery): Promise<Page<Quotation>> {
    return this.quoteRepo.list(actor.tenantId, query);
  }

  async getById(actor: Actor, id: string): Promise<Quotation> {
    const quote = await this.quoteRepo.findById(actor.tenantId, id);
    if (!quote) {
      throw new NotFoundError(`Quotation with ID ${id} not found`);
    }
    return quote;
  }

  async createDraft(
    actor: Actor,
    input: CreateQuotationDraftInput
  ): Promise<Quotation> {
    const quote = await this.quoteRepo.create({
      tenantId: actor.tenantId,
      enquiryId: input.enquiryId,
      customerId: input.customerId,
      lineItems: input.lineItems,
      materialCostPaise: input.materialCostPaise,
      processingCostPaise: input.processingCostPaise,
      overheadCostPaise: input.overheadCostPaise,
      wastagePct: input.wastagePct,
      wastageCostPaise: input.wastageCostPaise,
      riskBufferPct: input.riskBufferPct,
      riskBufferCostPaise: input.riskBufferCostPaise,
      subtotalCostPaise: input.subtotalCostPaise,
      marginPct: input.marginPct,
      profitPaise: input.profitPaise,
      finalPricePaise: input.finalPricePaise,
      etaDate: input.etaDate,
      validUntil: input.validUntil,
      status: QuotationStatus.DRAFT,
      explanation: input.explanation,
      assumptions: input.assumptions,
      inputsSnapshot: input.inputsSnapshot,
    });

    if (this.audit) {
      await this.audit.record({
        tenantId: actor.tenantId,
        userId: actor.userId,
        userRole: actor.role,
        action: "QUOTATION_DRAFT_CREATED",
        entity: "quotation",
        entityId: quote.id,
        changes: { quotationNumber: quote.quotationNumber, finalPricePaise: quote.finalPricePaise },
      });
    }

    return quote;
  }

  async markFailed(
    actor: Actor,
    id: string,
    error: string
  ): Promise<Quotation> {
    const quote = await this.quoteRepo.update(actor.tenantId, id, {
      status: QuotationStatus.GENERATION_FAILED,
      generationError: error,
    });
    if (!quote) {
      throw new NotFoundError(`Quotation with ID ${id} not found`);
    }
    return quote;
  }

  async approve(actor: Actor, id: string): Promise<Quotation> {
    const quote = await this.quoteRepo.findById(actor.tenantId, id);
    if (!quote) {
      throw new NotFoundError(`Quotation with ID ${id} not found`);
    }
    if (quote.status === QuotationStatus.CONFIRMED) {
      throw new BadRequestError("Quotation has already been confirmed into an order");
    }

    const updated = await this.quoteRepo.update(actor.tenantId, id, {
      status: QuotationStatus.APPROVED,
      approvedBy: actor.userId,
      approvedAt: new Date(),
    });

    if (this.audit) {
      await this.audit.record({
        tenantId: actor.tenantId,
        userId: actor.userId,
        userRole: actor.role,
        action: "QUOTATION_APPROVED",
        entity: "quotation",
        entityId: id,
      });
    }

    return updated!;
  }

  async send(
    actor: Actor,
    id: string
  ): Promise<{ quotation: Quotation; pdfBuffer: Buffer }> {
    const quote = await this.quoteRepo.findById(actor.tenantId, id);
    if (!quote) {
      throw new NotFoundError(`Quotation with ID ${id} not found`);
    }

    const customer = await this.customerRepo.findById(actor.tenantId, quote.customerId);
    const customerName = customer ? customer.name : "Valued Customer";

    const pdfData: QuotationPdfData = {
      quotationNumber: quote.quotationNumber,
      customerName,
      validUntil: quote.validUntil,
      etaDate: quote.etaDate,
      lineItems: quote.lineItems.map((li) => ({
        materialName: li.materialName,
        requiredQty: li.requiredQty,
        unit: li.unit,
        unitCostPaise: li.unitCostPaise,
        totalCostPaise: li.totalCostPaise,
      })),
      subtotalCostPaise: quote.subtotalCostPaise,
      riskBufferPct: quote.riskBufferPct,
      riskBufferCostPaise: quote.riskBufferCostPaise,
      wastagePct: quote.wastagePct,
      wastageCostPaise: quote.wastageCostPaise,
      marginPct: quote.marginPct,
      finalPricePaise: quote.finalPricePaise,
      explanation: quote.explanation,
    };

    const pdfBuffer = await this.pdfRenderer.renderQuotation(pdfData);

    const updated = await this.quoteRepo.update(actor.tenantId, id, {
      status: QuotationStatus.SENT,
      sentAt: new Date(),
    });

    if (this.audit) {
      await this.audit.record({
        tenantId: actor.tenantId,
        userId: actor.userId,
        userRole: actor.role,
        action: "QUOTATION_SENT",
        entity: "quotation",
        entityId: id,
      });
    }

    return { quotation: updated!, pdfBuffer };
  }

  /**
   * Transactional order confirmation:
   * 1. Reserves stock for all line items
   * 2. Builds production plan per process
   * 3. Creates production order
   * 4. Updates quotation status to confirmed
   */
  async confirmOrder(
    actor: Actor,
    quotationId: string
  ): Promise<ProductionOrder> {
    return this.uow.run(async (tx) => {
      const quote = await this.quoteRepo.findById(actor.tenantId, quotationId, tx);
      if (!quote) {
        throw new NotFoundError(`Quotation ${quotationId} not found`);
      }

      if (quote.status === QuotationStatus.CONFIRMED) {
        throw new BadRequestError("Quotation is already confirmed");
      }

      // 1. Create stock reservations and ledger movements for each material
      for (const item of quote.lineItems) {
        if (item.onHandQty > 0) {
          const reserveQty = Math.min(item.onHandQty, item.requiredQty);

          await this.materialRepo.createReservation(
            {
              tenantId: actor.tenantId,
              materialId: item.materialId,
              orderId: quote.id,
              quantity: reserveQty,
              status: "reserved",
            },
            tx
          );

          const mat = await this.materialRepo.findById(actor.tenantId, item.materialId, tx);
          if (mat) {
            await this.materialRepo.update(
              actor.tenantId,
              mat.id,
              { reservedQuantity: mat.reservedQuantity + reserveQty },
              tx
            );

            await this.materialRepo.recordMovement(
              {
                tenantId: actor.tenantId,
                materialId: item.materialId,
                type: StockMovementType.RESERVATION,
                quantity: reserveQty,
                previousBalance: mat.onHandQuantity,
                newBalance: mat.onHandQuantity,
                referenceType: "reservation",
                referenceId: quote.id,
                notes: `Stock reserved for quotation ${quote.quotationNumber}`,
              },
              tx
            );
          }
        }
      }

      // 2. Fetch processes to build staged production plan
      const processes = await this.processRepo.listAllOrdered(actor.tenantId, tx);
      const totalQty = quote.inputsSnapshot?.targetQty || 1000;

      const plan: ProcessPlanStep[] = processes.map((proc, index) => {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() + index * 5);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 5);

        return {
          processId: proc.id,
          processName: proc.name,
          sequence: proc.sequence,
          targetQty: totalQty,
          dailyTarget: Math.round(totalQty / 5),
          startDate: startDate.toISOString().split("T")[0]!,
          endDate: endDate.toISOString().split("T")[0]!,
          completedQty: 0,
        };
      });

      // 3. Create ProductionOrder
      const order = await this.orderRepo.create(
        {
          tenantId: actor.tenantId,
          quotationId: quote.id,
          customerId: quote.customerId,
          productName: quote.inputsSnapshot?.productName || "Fabric",
          totalQuantity: totalQty,
          unit: quote.inputsSnapshot?.unit || "meters",
          status: OrderStatus.PLANNED,
          startDate: new Date().toISOString().split("T")[0]!,
          targetDeliveryDate: quote.etaDate,
          plan,
        },
        tx
      );

      // 4. Update quotation status
      await this.quoteRepo.update(
        actor.tenantId,
        quote.id,
        { status: QuotationStatus.CONFIRMED },
        tx
      );

      if (this.audit) {
        await this.audit.record(
          {
            tenantId: actor.tenantId,
            userId: actor.userId,
            userRole: actor.role,
            action: "QUOTATION_CONFIRMED",
            entity: "quotation",
            entityId: quote.id,
            changes: { orderId: order.id, orderNumber: order.orderNumber },
          },
          tx
        );
      }

      return order;
    });
  }
}
