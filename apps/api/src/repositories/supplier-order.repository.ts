import {
  ISupplierOrderRepository,
  SupplierOrder,
  NewSupplierOrder,
  SupplierOrderStatus,
} from "../interfaces/supplier-order.repository.js";
import { TxContext } from "../interfaces/unit-of-work.js";
import { ListQuery, Page, toPage } from "../utils/pagination.js";
import { SupplierOrderModel } from "../models/supplier-order.model.js";

export class MongoSupplierOrderRepository implements ISupplierOrderRepository {
  private toEntity(doc: any): SupplierOrder {
    return {
      id: doc._id.toString(),
      tenantId: doc.tenantId,
      orderNumber: doc.orderNumber,
      supplierId: doc.supplierId.toString(),
      status: doc.status,
      items: (doc.items || []).map((item: any) => ({
        materialId: item.materialId.toString(),
        quantity: item.quantity,
        unitCostPaise: item.unitCostPaise,
        receivedQty: item.receivedQty || 0,
      })),
      expectedDeliveryDate: doc.expectedDeliveryDate,
      placedAt: doc.placedAt,
      notes: doc.notes,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async create(data: NewSupplierOrder, tx?: TxContext): Promise<SupplierOrder> {
    const docs = await SupplierOrderModel.create([data], { session: tx?.session || null });
    return this.toEntity(docs[0]!);
  }

  async findById(tenantId: string, id: string, tx?: TxContext): Promise<SupplierOrder | null> {
    const doc = await SupplierOrderModel.findOne({ _id: id, tenantId })
      .session(tx?.session || null)
      .lean();
    return doc ? this.toEntity(doc) : null;
  }

  async findByOrderNumber(
    tenantId: string,
    orderNumber: string,
    tx?: TxContext
  ): Promise<SupplierOrder | null> {
    const doc = await SupplierOrderModel.findOne({ tenantId, orderNumber })
      .session(tx?.session || null)
      .lean();
    return doc ? this.toEntity(doc) : null;
  }

  async update(
    tenantId: string,
    id: string,
    data: Partial<SupplierOrder>,
    tx?: TxContext
  ): Promise<SupplierOrder | null> {
    const doc = await SupplierOrderModel.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: data },
      { new: true, session: tx?.session || null }
    ).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async list(
    tenantId: string,
    query?: ListQuery & { supplierId?: string; status?: SupplierOrderStatus }
  ): Promise<Page<SupplierOrder>> {
    const page = query?.page || 1;
    const limit = query?.limit || 50;
    const skip = (page - 1) * limit;

    const filter: any = { tenantId };
    if (query?.supplierId) {
      filter.supplierId = query.supplierId;
    }
    if (query?.status) {
      filter.status = query.status;
    }

    const [docs, total] = await Promise.all([
      SupplierOrderModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SupplierOrderModel.countDocuments(filter),
    ]);

    return toPage(
      docs.map((d) => this.toEntity(d)),
      total,
      page,
      limit
    );
  }
}

