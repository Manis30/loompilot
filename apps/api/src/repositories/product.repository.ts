import mongoose from "mongoose";
import { BaseRepository } from "./base.repository.js";
import { IProduct, ProductModel } from "../models/catalog/product.model.js";
import { PaginationQuery, PaginatedResult, paginate } from "../utils/pagination.js";
import { TxContext } from "../interfaces/unit-of-work.interface.js";

export class ProductRepository extends BaseRepository<IProduct> {
  constructor() {
    super(ProductModel);
  }

  override async findById(tenantId: string, id: string, tx?: TxContext): Promise<IProduct | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    return super.findById(tenantId, id, tx);
  }

  async findClientSafePaginated(
    tenantId: string,
    pagination: PaginationQuery,
    filterOptions?: { search?: string; category?: string }
  ): Promise<PaginatedResult<any>> {
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("Database not connected");
    }

    const { page, limit, sortBy, sortOrder } = pagination;
    const skip = (page - 1) * limit;
    const sort: Record<string, 1 | -1> = sortBy
      ? { [sortBy]: sortOrder === "asc" ? 1 : -1 }
      : { createdAt: -1 };

    const filter: Record<string, any> = { tenantId, active: true };
    if (filterOptions?.category) {
      filter.category = { $regex: `^${filterOptions.category.trim()}$`, $options: "i" };
    }
    if (filterOptions?.search) {
      const searchRegex = { $regex: filterOptions.search.trim(), $options: "i" };
      filter.$or = [{ productName: searchRegex }, { category: searchRegex }];
    }

    const collections = await db.listCollections({ name: "clientSafeProducts" }).toArray();

    if (collections.length > 0) {
      const view = db.collection("clientSafeProducts");
      const [items, total] = await Promise.all([
        view.find(filter).sort(sort).skip(skip).limit(limit).toArray(),
        view.countDocuments(filter),
      ]);
      return paginate(items, total, page, limit);
    }

    const [items, total] = await Promise.all([
      ProductModel.find(
        filter,
        {
          _id: 1,
          tenantId: 1,
          productName: 1,
          category: 1,
          basePricePaise: 1,
          imageFileIds: 1,
          createdAt: 1,
          updatedAt: 1,
        }
      )
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      ProductModel.countDocuments(filter),
    ]);

    return paginate(items, total, page, limit);
  }

  async findClientSafeById(tenantId: string, id: string): Promise<any | null> {
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("Database not connected");
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }

    const collections = await db.listCollections({ name: "clientSafeProducts" }).toArray();
    if (collections.length > 0) {
      const view = db.collection("clientSafeProducts");
      return view.findOne({ tenantId, _id: new mongoose.Types.ObjectId(id), active: true });
    }

    return ProductModel.findOne(
      { tenantId, _id: new mongoose.Types.ObjectId(id), active: true },
      {
        _id: 1,
        tenantId: 1,
        productName: 1,
        category: 1,
        basePricePaise: 1,
        imageFileIds: 1,
        createdAt: 1,
        updatedAt: 1,
      }
    ).lean();
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
      imageFileIds?: string[];
      active?: boolean;
    },
    tx?: TxContext
  ): Promise<IProduct | null> {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return null;
    }
    const session = this.getSession(tx);
    const updatePayload: Record<string, any> = {};

    if (updates.productName !== undefined) updatePayload.productName = updates.productName;
    if (updates.category !== undefined) updatePayload.category = updates.category;
    if (updates.basePricePaise !== undefined) updatePayload.basePricePaise = updates.basePricePaise;
    if (updates.active !== undefined) updatePayload.active = updates.active;

    if (updates.bom !== undefined) {
      updatePayload.bom = updates.bom.map((b) => ({
        materialId: new mongoose.Types.ObjectId(b.materialId),
        qtyPerUnit: b.qtyPerUnit,
        wastage: b.wastage ?? 0,
      }));
    }

    if (updates.routing !== undefined) {
      updatePayload.routing = updates.routing;
    }

    if (updates.imageFileIds !== undefined) {
      updatePayload.imageFileIds = updates.imageFileIds.map(
        (id) => new mongoose.Types.ObjectId(id)
      );
    }

    return this.model
      .findOneAndUpdate(
        { tenantId, _id: new mongoose.Types.ObjectId(productId) },
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
    if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(fileId)) {
      return null;
    }
    const session = this.getSession(tx);
    return this.model
      .findOneAndUpdate(
        { tenantId, _id: new mongoose.Types.ObjectId(productId) },
        {
          $addToSet: { imageFileIds: new mongoose.Types.ObjectId(fileId) },
          $inc: { version: 1 },
        },
        { new: true, session: session ?? null }
      )
      .lean<IProduct>()
      .exec();
  }

  async isProductImage(
    tenantId: string,
    fileId: string,
    activeOnly = false
  ): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return false;
    }
    const filter: Record<string, any> = {
      tenantId,
      imageFileIds: new mongoose.Types.ObjectId(fileId),
    };
    if (activeOnly) {
      filter.active = true;
    }
    const count = await this.model.countDocuments(filter);
    return count > 0;
  }

  async isProcessAreaUsed(tenantId: string, area: string): Promise<boolean> {
    const count = await this.model.countDocuments({
      tenantId,
      active: true,
      "routing.stage": area,
    });
    return count > 0;
  }
}
