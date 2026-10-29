import {
  ICustomerRepository,
  Customer,
  NewCustomer,
} from "../interfaces/customer.repository.js";
import { TxContext } from "../interfaces/unit-of-work.js";
import { ListQuery, Page, toPage } from "../utils/pagination.js";
import { CustomerModel } from "../models/customer.model.js";

export class MongoCustomerRepository implements ICustomerRepository {
  private toEntity(doc: any): Customer {
    return {
      id: doc._id.toString(),
      tenantId: doc.tenantId,
      name: doc.name,
      code: doc.code,
      contactPerson: doc.contactPerson,
      email: doc.email,
      phone: doc.phone,
      address: doc.address,
      creditPeriodDays: doc.creditPeriodDays,
      gstin: doc.gstin,
      preferredChannel: doc.preferredChannel || "whatsapp",
      notes: doc.notes,
      active: doc.active ?? true,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async create(data: NewCustomer, tx?: TxContext): Promise<Customer> {
    const docs = await CustomerModel.create([data], { session: tx?.session || null });
    return this.toEntity(docs[0]!);
  }

  async findById(tenantId: string, id: string): Promise<Customer | null> {
    const doc = await CustomerModel.findOne({ _id: id, tenantId }).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async findByCode(tenantId: string, code: string, tx?: TxContext): Promise<Customer | null> {
    const doc = await CustomerModel.findOne({ tenantId, code })
      .session(tx?.session || null)
      .lean();
    return doc ? this.toEntity(doc) : null;
  }

  async findByEmail(tenantId: string, email: string): Promise<Customer | null> {
    const doc = await CustomerModel.findOne({ tenantId, email: email.toLowerCase().trim() }).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async update(
    tenantId: string,
    id: string,
    data: Partial<Customer>,
    tx?: TxContext
  ): Promise<Customer | null> {
    const doc = await CustomerModel.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: data },
      { new: true, session: tx?.session || null }
    ).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async list(tenantId: string, query?: ListQuery): Promise<Page<Customer>> {
    const page = query?.page || 1;
    const limit = query?.limit || 50;
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      CustomerModel.find({ tenantId })
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CustomerModel.countDocuments({ tenantId }),
    ]);

    return toPage(docs.map((d) => this.toEntity(d)), total, page, limit);
  }

  async count(tenantId: string): Promise<number> {
    return CustomerModel.countDocuments({ tenantId });
  }
}

