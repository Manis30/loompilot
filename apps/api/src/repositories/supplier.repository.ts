import { ISupplierRepository, Supplier, NewSupplier } from "../interfaces/supplier.repository.js";
import { TxContext } from "../interfaces/unit-of-work.js";
import { ListQuery, Page, toPage } from "../utils/pagination.js";
import { SupplierModel } from "../models/supplier.model.js";

export class MongoSupplierRepository implements ISupplierRepository {
  private toEntity(doc: any): Supplier {
    return {
      id: doc._id.toString(),
      tenantId: doc.tenantId,
      name: doc.name,
      code: doc.code,
      contactPerson: doc.contactPerson,
      email: doc.email,
      phone: doc.phone,
      address: doc.address,
      gstin: doc.gstin,
      paymentTermsDays: doc.paymentTermsDays,
      leadTimeDays: doc.leadTimeDays,
      rating: doc.rating,
      suppliedMaterials: (doc.suppliedMaterials || []).map((m: any) => m.toString()),
      active: doc.active ?? true,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async create(data: NewSupplier, tx?: TxContext): Promise<Supplier> {
    const docs = await SupplierModel.create([data], { session: tx?.session || null });
    return this.toEntity(docs[0]!);
  }

  async findById(tenantId: string, id: string, tx?: TxContext): Promise<Supplier | null> {
    const doc = await SupplierModel.findOne({ _id: id, tenantId })
      .session(tx?.session || null)
      .lean();
    return doc ? this.toEntity(doc) : null;
  }

  async findByCode(tenantId: string, code: string, tx?: TxContext): Promise<Supplier | null> {
    const doc = await SupplierModel.findOne({ tenantId, code })
      .session(tx?.session || null)
      .lean();
    return doc ? this.toEntity(doc) : null;
  }

  async findByName(tenantId: string, name: string, tx?: TxContext): Promise<Supplier | null> {
    const doc = await SupplierModel.findOne({ tenantId, name })
      .session(tx?.session || null)
      .lean();
    return doc ? this.toEntity(doc) : null;
  }

  async update(
    tenantId: string,
    id: string,
    data: Partial<Supplier>,
    tx?: TxContext
  ): Promise<Supplier | null> {
    const doc = await SupplierModel.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: data },
      { new: true, session: tx?.session || null }
    ).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async list(tenantId: string, query?: ListQuery): Promise<Page<Supplier>> {
    const page = query?.page || 1;
    const limit = query?.limit || 50;
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      SupplierModel.find({ tenantId })
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SupplierModel.countDocuments({ tenantId }),
    ]);

    return toPage(
      docs.map((d) => this.toEntity(d)),
      total,
      page,
      limit
    );
  }
}

