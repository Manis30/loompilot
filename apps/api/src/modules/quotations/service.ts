import mongoose from "mongoose";
import { QuotationModel, IQuotation } from "./model.js";
import { ProductionOrderModel, IProductionOrder } from "../orders/model.js";
import { ProcessModel } from "../processes/model.js";
import { ReservationModel, MaterialModel, StockMovementModel } from "../../models/material.model.js";
import { CustomerModel } from "../../models/customer.model.js";
import { QuotationStatus, OrderStatus, StockMovementType } from "@loompilot/shared";
import { generateQuotationPdf } from "../../lib/pdf.js";

export class QuotationService {
  static async list(tenantId: string): Promise<IQuotation[]> {
    return QuotationModel.find({ tenantId }).sort({ createdAt: -1 });
  }

  static async getById(tenantId: string, id: string): Promise<IQuotation | null> {
    return QuotationModel.findOne({ _id: id, tenantId });
  }

  static async create(data: Partial<IQuotation> & { tenantId: string }): Promise<IQuotation> {
    const count = await QuotationModel.countDocuments({ tenantId: data.tenantId });
    const quotationNumber = `QT-${String(count + 1).padStart(5, "0")}`;
    return QuotationModel.create({
      ...data,
      quotationNumber: data.quotationNumber || quotationNumber,
    });
  }

  static async markFailed(
    tenantId: string,
    id: string,
    error: string
  ): Promise<IQuotation | null> {
    return QuotationModel.findOneAndUpdate(
      { _id: id, tenantId },
      {
        status: QuotationStatus.GENERATION_FAILED,
        generationError: error,
      },
      { new: true }
    );
  }

  static async approve(
    tenantId: string,
    id: string,
    userId: string
  ): Promise<IQuotation | null> {
    const quote = await QuotationModel.findOne({ _id: id, tenantId });
    if (!quote) throw new Error("Quotation not found");
    if (quote.status === QuotationStatus.CONFIRMED) {
      throw new Error("Quotation has already been confirmed into an order");
    }

    quote.status = QuotationStatus.APPROVED;
    quote.approvedBy = new mongoose.Types.ObjectId(userId);
    quote.approvedAt = new Date();
    await quote.save();
    return quote;
  }

  static async send(tenantId: string, id: string): Promise<{ quotation: IQuotation; pdfBuffer: Buffer }> {
    const quote = await QuotationModel.findOne({ _id: id, tenantId });
    if (!quote) throw new Error("Quotation not found");

    const customer = await CustomerModel.findOne({ _id: quote.customerId, tenantId });
    const customerName = customer ? customer.name : "Valued Customer";

    const pdfBuffer = await generateQuotationPdf({
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
    });

    quote.status = QuotationStatus.SENT;
    quote.sentAt = new Date();
    await quote.save();

    return { quotation: quote, pdfBuffer };
  }

  /**
   * Transactional order confirmation:
   * 1. Reserves stock for all line items
   * 2. Builds production plan per process
   * 3. Creates production order
   * 4. Updates quotation status to confirmed
   */
  static async confirmOrder(
    tenantId: string,
    quotationId: string,
    customSession?: mongoose.ClientSession
  ): Promise<IProductionOrder> {
    const session = customSession || (await mongoose.startSession());
    const isLocalSession = !customSession;

    try {
      if (isLocalSession) {
        session.startTransaction();
      }

      const quote = await QuotationModel.findOne({ _id: quotationId, tenantId }).session(session);
      if (!quote) {
        throw new Error(`Quotation ${quotationId} not found`);
      }

      if (quote.status === QuotationStatus.CONFIRMED) {
        throw new Error("Quotation is already confirmed");
      }

      // 1. Create stock reservations and ledger movements for each material
      for (const item of quote.lineItems) {
        if (item.onHandQty > 0) {
          const reserveQty = Math.min(item.onHandQty, item.requiredQty);
          await ReservationModel.create(
            [
              {
                tenantId,
                materialId: item.materialId,
                orderId: quote._id,
                quantity: reserveQty,
                status: "reserved",
              },
            ],
            { session }
          );

          const mat = await MaterialModel.findOne({ _id: item.materialId, tenantId }).session(session);
          if (mat) {
            mat.reservedQuantity = mat.reservedQuantity + reserveQty;
            await mat.save({ session });
            await StockMovementModel.create(
              [
                {
                  tenantId,
                  materialId: item.materialId,
                  type: StockMovementType.RESERVATION,
                  quantity: reserveQty,
                  previousBalance: mat.onHandQuantity,
                  newBalance: mat.onHandQuantity,
                  referenceType: "reservation",
                  referenceId: quote._id.toString(),
                  notes: `Stock reserved for quotation ${quote.quotationNumber}`,
                },
              ],
              { session }
            );
          }
        }
      }

      // 2. Fetch processes to build staged production plan
      const processes = await ProcessModel.find({ tenantId }).sort({ sequence: 1 }).session(session);
      const totalQty = quote.inputsSnapshot?.targetQty || 1000;
      const orderCount = await ProductionOrderModel.countDocuments({ tenantId }).session(session);
      const orderNumber = `PO-${String(orderCount + 1).padStart(5, "0")}`;

      const plan = processes.map((proc, index) => {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() + index * 5);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 5);

        return {
          processId: proc._id as mongoose.Types.ObjectId,
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
      const [order] = await ProductionOrderModel.create(
        [
          {
            tenantId,
            quotationId: quote._id,
            customerId: quote.customerId,
            orderNumber,
            productName: quote.inputsSnapshot?.productName || "Fabric",
            totalQuantity: totalQty,
            unit: quote.inputsSnapshot?.unit || "meters",
            status: OrderStatus.PLANNED,
            startDate: new Date().toISOString().split("T")[0]!,
            targetDeliveryDate: quote.etaDate,
            plan,
          },
        ],
        { session }
      );

      // 4. Update quotation status
      quote.status = QuotationStatus.CONFIRMED;
      await quote.save({ session });

      if (isLocalSession) {
        await session.commitTransaction();
      }

      return order!;
    } catch (err) {
      if (isLocalSession) {
        await session.abortTransaction();
      }
      throw err;
    } finally {
      if (isLocalSession) {
        await session.endSession();
      }
    }
  }
}
