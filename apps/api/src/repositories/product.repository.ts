import mongoose from "mongoose";
import {
  IProductRepository,
  Product,
  NewProduct,
  Bom,
  NewBom,
} from "../interfaces/product.repository.js";
import { TxContext } from "../interfaces/unit-of-work.js";
import { ProductModel, BomModel } from "../models/product.model.js";

export class MongoProductRepository implements IProductRepository {
  private toProductEntity(doc: any): Product {
    return {
      id: doc._id.toString(),
      tenantId: doc.tenantId,
      code: doc.code,
      name: doc.name,
      description: doc.description,
      unit: doc.unit,
      active: doc.active ?? true,
      category: doc.category,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  private toBomEntity(doc: any): Bom {
    return {
      id: doc._id.toString(),
      tenantId: doc.tenantId,
      productId: doc.productId.toString(),
      version: doc.version,
      effectiveFrom: doc.effectiveFrom,
      effectiveTo: doc.effectiveTo,
      items: (doc.items || []).map((item: any) => ({
        materialId: item.materialId.toString(),
        quantityPerUnit: item.quantityPerUnit,
        unit: item.unit,
        wastageAllowancePct: item.wastageAllowancePct || 0,
      })),
      createdAt: doc.createdAt,
    };
  }

  async list(
    tenantId: string,
    filter?: { activeOnly?: boolean; category?: string }
  ): Promise<Product[]> {
    const query: any = { tenantId };
    if (filter?.activeOnly) query.active = true;
    if (filter?.category) query.category = filter.category;

    const docs = await ProductModel.find(query).sort({ code: 1 }).lean();
    return docs.map((d: any) => this.toProductEntity(d));
  }

  async findById(tenantId: string, id: string): Promise<Product | null> {
    const doc = await ProductModel.findOne({ _id: id, tenantId }).lean();
    return doc ? this.toProductEntity(doc) : null;
  }

  async findByCode(tenantId: string, code: string): Promise<Product | null> {
    const doc = await ProductModel.findOne({ tenantId, code }).lean();
    return doc ? this.toProductEntity(doc) : null;
  }

  async create(data: NewProduct, tx?: TxContext): Promise<Product> {
    const docs = await ProductModel.create([data], { session: tx?.session || null });
    return this.toProductEntity(docs[0]!);
  }

  async update(
    tenantId: string,
    id: string,
    data: Partial<Product>,
    tx?: TxContext
  ): Promise<Product | null> {
    const doc = await ProductModel.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: data },
      { new: true, session: tx?.session || null }
    ).lean();
    return doc ? this.toProductEntity(doc) : null;
  }

  async getActiveBom(tenantId: string, productId: string): Promise<Bom | null> {
    const now = new Date();
    const doc = await BomModel.findOne({
      tenantId,
      productId: new mongoose.Types.ObjectId(productId),
      effectiveFrom: { $lte: now },
      $or: [{ effectiveTo: null }, { effectiveTo: { $gt: now } }],
    })
      .sort({ version: -1 })
      .lean();

    return doc ? this.toBomEntity(doc) : null;
  }

  async listBoms(tenantId: string, productId: string): Promise<Bom[]> {
    const docs = await BomModel.find({
      tenantId,
      productId: new mongoose.Types.ObjectId(productId),
    })
      .sort({ version: -1 })
      .lean();

    return docs.map((d: any) => this.toBomEntity(d));
  }

  async createBomVersion(data: NewBom, tx?: TxContext): Promise<Bom> {
    const now = new Date();
    const effectiveFrom = data.effectiveFrom || now;

    // 1. Find previous active BOM version and set effectiveTo
    const latest = await BomModel.findOne({
      tenantId: data.tenantId,
      productId: new mongoose.Types.ObjectId(data.productId),
    })
      .sort({ version: -1 })
      .session(tx?.session || null);

    const nextVersion = latest ? latest.version + 1 : 1;

    if (latest && (!latest.effectiveTo || latest.effectiveTo > effectiveFrom)) {
      latest.effectiveTo = effectiveFrom;
      await latest.save({ session: tx?.session || null });
    }

    // 2. Create new version
    const newItems = data.items.map((item) => ({
      materialId: new mongoose.Types.ObjectId(item.materialId),
      quantityPerUnit: item.quantityPerUnit,
      unit: item.unit,
      wastageAllowancePct: item.wastageAllowancePct,
    }));

    const docs = await BomModel.create(
      [
        {
          tenantId: data.tenantId,
          productId: new mongoose.Types.ObjectId(data.productId),
          version: nextVersion,
          effectiveFrom,
          effectiveTo: null,
          items: newItems,
        },
      ],
      { session: tx?.session || null }
    );

    return this.toBomEntity(docs[0]!);
  }
}
