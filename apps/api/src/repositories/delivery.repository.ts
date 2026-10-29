import {
  IDeliveryRepository,
  Delivery,
  NewDelivery,
} from "../interfaces/delivery.repository.js";
import { TxContext } from "../interfaces/unit-of-work.js";
import { ListQuery, Page, toPage } from "../utils/pagination.js";
import { DeliveryModel } from "../models/delivery.model.js";
import { getNextDocumentNumber } from "../models/counter.model.js";

export class MongoDeliveryRepository implements IDeliveryRepository {
  private toEntity(doc: any): Delivery {
    return {
      id: doc._id.toString(),
      tenantId: doc.tenantId,
      orderId: doc.orderId.toString(),
      customerId: doc.customerId.toString(),
      deliveryNumber: doc.deliveryNumber,
      deliveredQuantity: doc.deliveredQuantity,
      deliveryDate: doc.deliveryDate,
      status: doc.status,
      isOnTime: doc.isOnTime,
      invoiceNumber: doc.invoiceNumber,
      totalInvoicePaise: doc.totalInvoicePaise,
      receivedBy: doc.receivedBy,
      notes: doc.notes,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async create(data: NewDelivery, tx?: TxContext): Promise<Delivery> {
    const deliveryNumber =
      data.deliveryNumber ||
      (await getNextDocumentNumber(data.tenantId, "delivery", "DEL", 5, tx?.session));
    const invoiceNumber =
      data.invoiceNumber ||
      (await getNextDocumentNumber(data.tenantId, "invoice", "INV", 5, tx?.session));

    const docs = await DeliveryModel.create(
      [
        {
          ...data,
          deliveryNumber,
          invoiceNumber,
        },
      ],
      { session: tx?.session || null }
    );
    return this.toEntity(docs[0]!);
  }

  async findById(tenantId: string, id: string, tx?: TxContext): Promise<Delivery | null> {
    const doc = await DeliveryModel.findOne({ _id: id, tenantId })
      .session(tx?.session || null)
      .lean();
    return doc ? this.toEntity(doc) : null;
  }

  async findByDeliveryNumber(
    tenantId: string,
    deliveryNumber: string,
    tx?: TxContext
  ): Promise<Delivery | null> {
    const doc = await DeliveryModel.findOne({ tenantId, deliveryNumber })
      .session(tx?.session || null)
      .lean();
    return doc ? this.toEntity(doc) : null;
  }

  async list(tenantId: string, query?: ListQuery): Promise<Page<Delivery>> {
    const page = query?.page || 1;
    const limit = query?.limit || 50;
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      DeliveryModel.find({ tenantId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      DeliveryModel.countDocuments({ tenantId }),
    ]);

    return toPage(
      docs.map((d) => this.toEntity(d)),
      total,
      page,
      limit
    );
  }

  async count(tenantId: string, tx?: TxContext): Promise<number> {
    return DeliveryModel.countDocuments({ tenantId }).session(tx?.session || null);
  }
}

