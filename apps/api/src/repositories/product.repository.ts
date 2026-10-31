import mongoose from "mongoose";
import { BaseRepository } from "./base.repository.js";
import { IProduct, ProductModel } from "../models/catalog/product.model.js";
import { PaginationQuery, PaginatedResult, paginate } from "../utils/pagination.js";
import { TxContext } from "../interfaces/unit-of-work.interface.js";

export class ProductRepository extends BaseRepository<IProduct> {
  constructor() {
    super(ProductModel);
  }

  async findClientSafePaginated(
    tenantId: string,
    pagination: PaginationQuery
  ): Promise<PaginatedResult<any>> {
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("Database not connected");
    }

    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    // Read directly from the clientSafeProducts database view
    const view = db.collection("clientSafeProducts");
    const filter = { tenantId, active: true };

    const [items, total] = await Promise.all([
      view.find(filter).skip(skip).limit(limit).toArray(),
      view.countDocuments(filter),
    ]);

    return paginate(items, total, page, limit);
  }

  async findClientSafeById(tenantId: string, id: string): Promise<any | null> {
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("Database not connected");
    }

    const view = db.collection("clientSafeProducts");
    return view.findOne({ tenantId, _id: new mongoose.Types.ObjectId(id), active: true });
  }

  async createProductWithDetails(
    tenantId: string,
    data: {
      productName: string;
      category: string;
      basePricePaise: number;
      bom: Array<{ materialId: string; qtyPerUnit: number; wastage?: number }>;
      routing: Array<{ stage: string; seq: number; stdMinPerUnit: number }>;
      imageFileIds?: string[];
      active?: boolean;
    },
    tx?: TxContext
  ): Promise<IProduct> {
    return this.create(
      tenantId,
      {
        productName: data.productName,
        category: data.category,
        basePricePaise: data.basePricePaise,
        bom: data.bom.map((b) => ({
          materialId: new mongoose.Types.ObjectId(b.materialId),
          qtyPerUnit: b.qtyPerUnit,
          wastage: b.wastage ?? 0,
        })),
        routing: data.routing,
        imageFileIds: data.imageFileIds?.map((id) => new mongoose.Types.ObjectId(id)),
        active: data.active ?? true,
        version: 1,
      } as any,
      tx
    );
  }

  async updateProductWithDetails(
    tenantId: string,
    productId: string,
    updates: {
      productName?: string;
      category?: string;
      basePricePaise?: number;
      bom?: Array<{ materialId: string; qtyPerUnit: number; wastage?: number }>;
      routing?: Array<{ stage: string; seq: number; stdMinPerUnit: number }>;
      active?: boolean;
    },
    tx?: TxContext
  ): Promise<IProduct | null> {
    const session = this.getSession(tx);
    const updatePayload: Record<string, any> = { ...updates };
    if (updates.bom) {
      updatePayload.bom = updates.bom.map((b) => ({
        materialId: new mongoose.Types.ObjectId(b.materialId),
        qtyPerUnit: b.qtyPerUnit,
        wastage: b.wastage ?? 0,
      }));
    }

    return this.model
      .findOneAndUpdate(
        { tenantId, _id: productId },
        { $set: updatePayload, $inc: { version: 1 } },
        { new: true, session: session ?? null }
      )
      .lean<IProduct>()
      .exec();
  }

  async addImageFileId(
    tenantId: string,
    productId: string,
    fileId: string,
    tx?: TxContext
  ): Promise<IProduct | null> {
    const session = this.getSession(tx);
    return this.model
      .findOneAndUpdate(
        { tenantId, _id: productId },
        {
          $addToSet: { imageFileIds: new mongoose.Types.ObjectId(fileId) },
          $inc: { version: 1 },
        },
        { new: true, session: session ?? null }
      )
      .lean<IProduct>()
      .exec();
  }
}

