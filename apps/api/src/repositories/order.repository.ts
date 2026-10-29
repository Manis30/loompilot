import {
  IOrderRepository,
  ProductionOrder,
  NewProductionOrder,
  ProcessPlanStep,
} from "../interfaces/order.repository.js";
import { TxContext } from "../interfaces/unit-of-work.js";
import { ListQuery, Page, toPage } from "../utils/pagination.js";
import { ProductionOrderModel } from "../models/order.model.js";
import { getNextDocumentNumber } from "../models/counter.model.js";
import { OrderStatus } from "@loompilot/shared";

export class MongoOrderRepository implements IOrderRepository {
  private toEntity(doc: any): ProductionOrder {
    return {
      id: doc._id.toString(),
      tenantId: doc.tenantId,
      quotationId: doc.quotationId.toString(),
      customerId: doc.customerId.toString(),
      orderNumber: doc.orderNumber,
      productName: doc.productName,
      totalQuantity: doc.totalQuantity,
      unit: doc.unit,
      status: doc.status,
      startDate: doc.startDate,
      targetDeliveryDate: doc.targetDeliveryDate,
      actualDeliveryDate: doc.actualDeliveryDate,
      materialCostActualPaise: doc.materialCostActualPaise || 0,
      plan: (doc.plan || []).map((step: any): ProcessPlanStep => ({
        processId: step.processId.toString(),
        processName: step.processName,
        sequence: step.sequence,
        targetQty: step.targetQty,
        dailyTarget: step.dailyTarget,
        startDate: step.startDate,
        endDate: step.endDate,
        completedQty: step.completedQty || 0,
      })),
      version: doc.version || 1,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async create(data: NewProductionOrder, tx?: TxContext): Promise<ProductionOrder> {
    const orderNumber =
      data.orderNumber ||
      (await getNextDocumentNumber(data.tenantId, "order", "PO", 5, tx?.session));

    const docs = await ProductionOrderModel.create(
      [
        {
          ...data,
          orderNumber,
        },
      ],
      { session: tx?.session || null }
    );
    return this.toEntity(docs[0]!);
  }

  async findById(tenantId: string, id: string, tx?: TxContext): Promise<ProductionOrder | null> {
    const doc = await ProductionOrderModel.findOne({ _id: id, tenantId })
      .session(tx?.session || null)
      .lean();
    return doc ? this.toEntity(doc) : null;
  }

  async findByOrderNumber(
    tenantId: string,
    orderNumber: string,
    tx?: TxContext
  ): Promise<ProductionOrder | null> {
    const doc = await ProductionOrderModel.findOne({ tenantId, orderNumber })
      .session(tx?.session || null)
      .lean();
    return doc ? this.toEntity(doc) : null;
  }

  async updateStatus(
    tenantId: string,
    id: string,
    status: OrderStatus,
    actualDeliveryDate?: string,
    tx?: TxContext
  ): Promise<ProductionOrder | null> {
    const update: any = { status };
    if (actualDeliveryDate) {
      update.actualDeliveryDate = actualDeliveryDate;
    }
    const doc = await ProductionOrderModel.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: update },
      { new: true, session: tx?.session || null }
    ).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async addMaterialCost(
    tenantId: string,
    id: string,
    amountPaise: number,
    tx?: TxContext
  ): Promise<ProductionOrder | null> {
    const doc = await ProductionOrderModel.findOneAndUpdate(
      { _id: id, tenantId },
      { $inc: { materialCostActualPaise: amountPaise } },
      { new: true, session: tx?.session || null }
    ).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async list(tenantId: string, query?: ListQuery): Promise<Page<ProductionOrder>> {
    const page = query?.page || 1;
    const limit = query?.limit || 50;
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      ProductionOrderModel.find({ tenantId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ProductionOrderModel.countDocuments({ tenantId }),
    ]);

    return toPage(
      docs.map((d) => this.toEntity(d)),
      total,
      page,
      limit
    );
  }

  async count(tenantId: string, tx?: TxContext): Promise<number> {
    return ProductionOrderModel.countDocuments({ tenantId }).session(tx?.session || null);
  }
}
