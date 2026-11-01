import { Types } from "mongoose";
import { BaseRepository } from "./base.repository.js";
import { IMaterial, MaterialModel } from "../models/catalog/material.model.js";
import { TxContext } from "../interfaces/unit-of-work.interface.js";

export class MaterialRepository extends BaseRepository<IMaterial> {
  constructor() {
    super(MaterialModel);
  }

  async createMaterial(
    tenantId: string,
    data: {
      materialName: string;
      type: "yarn" | "fabric" | "dye_chemical" | "trim" | "packing";
      stockQty?: number;
      reorderLevel?: number;
      currentRatePaise: number;
      preferredSupplierId?: string;
      unit?: string;
      watchlist?: boolean;
    },
    tx?: TxContext
  ): Promise<IMaterial> {
    return this.create(
      tenantId,
      {
        ...data,
        stockQty: data.stockQty ?? 0,
        reservedQty: 0,
        reorderLevel: data.reorderLevel ?? 0,
        preferredSupplierId: data.preferredSupplierId ? new Types.ObjectId(data.preferredSupplierId) : undefined,
        version: 1,
      } as any,
      tx
    );
  }

  async updateRate(
    tenantId: string,
    materialId: string,
    currentRatePaise: number,
    tx?: TxContext
  ): Promise<IMaterial | null> {
    const session = this.getSession(tx);
    return this.model
      .findOneAndUpdate(
        { tenantId, _id: materialId },
        { $set: { currentRatePaise }, $inc: { version: 1 } },
        { new: true, session: session ?? null }
      )
      .lean<IMaterial>()
      .exec();
  }

  async updateOffers(
    tenantId: string,
    materialId: string,
    offers: Array<{ supplierId: string; ratePaise: number; leadDays: number }>,
    tx?: TxContext
  ): Promise<IMaterial | null> {
    const session = this.getSession(tx);
    const mappedOffers = offers.map((o) => ({
      supplierId: new Types.ObjectId(o.supplierId),
      ratePaise: o.ratePaise,
      leadDays: o.leadDays,
    }));

    return this.model
      .findOneAndUpdate(
        { tenantId, _id: materialId },
        { $set: { supplierOffers: mappedOffers }, $inc: { version: 1 } },
        { new: true, session: session ?? null }
      )
      .lean<IMaterial>()
      .exec();
  }

  async adjustStock(
    tenantId: string,
    materialId: string,
    deltaQty: number,
    tx?: TxContext
  ): Promise<IMaterial | null> {
    const session = this.getSession(tx);
    const filter: Record<string, any> = { tenantId, _id: materialId };

    if (deltaQty < 0) {
      filter.stockQty = { $gte: Math.abs(deltaQty) };
    }

    return this.model
      .findOneAndUpdate(
        filter,
        { $inc: { stockQty: deltaQty, version: 1 } },
        { new: true, session: session ?? null }
      )
      .lean<IMaterial>()
      .exec();
  }

  async reserveStock(
    tenantId: string,
    materialId: string,
    qty: number,
    tx?: TxContext
  ): Promise<IMaterial | null> {
    const session = this.getSession(tx);
    return this.model
      .findOneAndUpdate(
        {
          tenantId,
          _id: materialId,
          $expr: {
            $gte: [{ $subtract: ["$stockQty", "$reservedQty"] }, qty],
          },
        },
        { $inc: { reservedQty: qty, version: 1 } },
        { new: true, session: session ?? null }
      )
      .lean<IMaterial>()
      .exec();
  }

  async releaseStock(
    tenantId: string,
    materialId: string,
    qty: number,
    tx?: TxContext
  ): Promise<IMaterial | null> {
    const session = this.getSession(tx);
    return this.model
      .findOneAndUpdate(
        {
          tenantId,
          _id: materialId,
          reservedQty: { $gte: qty },
        },
        { $inc: { reservedQty: -qty, version: 1 } },
        { new: true, session: session ?? null }
      )
      .lean<IMaterial>()
      .exec();
  }

  async consumeStock(
    tenantId: string,
    materialId: string,
    qty: number,
    fromReserved = true,
    tx?: TxContext
  ): Promise<IMaterial | null> {
    const session = this.getSession(tx);
    const filter: Record<string, any> = { tenantId, _id: materialId };
    const incOps: Record<string, any> = { stockQty: -qty, version: 1 };

    if (fromReserved) {
      filter.stockQty = { $gte: qty };
      filter.reservedQty = { $gte: qty };
      incOps.reservedQty = -qty;
    } else {
      filter.$expr = { $gte: [{ $subtract: ["$stockQty", "$reservedQty"] }, qty] };
    }

    return this.model
      .findOneAndUpdate(
        filter,
        { $inc: incOps },
        { new: true, session: session ?? null }
      )
      .lean<IMaterial>()
      .exec();
  }

  async getStockSummary(tenantId: string): Promise<{
    totalMaterials: number;
    lowStockCount: number;
    byGroup: Record<string, { count: number; totalStock: number }>;
    totalValuationPaise: number;
  }> {
    const pipeline = [
      { $match: { tenantId, status: "active" } },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                totalMaterials: { $sum: 1 },
                totalValuationPaise: {
                  $sum: { $multiply: [{ $ifNull: ["$stockQty", 0] }, { $ifNull: ["$currentRatePaise", 0] }] },
                },
                lowStockCount: {
                  $sum: {
                    $cond: [
                      { $lte: [{ $ifNull: ["$stockQty", 0] }, { $ifNull: ["$reorderLevel", 0] }] },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ],
          byGroup: [
            {
              $group: {
                _id: "$type",
                count: { $sum: 1 },
                totalStock: { $sum: { $ifNull: ["$stockQty", 0] } },
              },
            },
          ],
        },
      },
    ];

    const [res] = await this.model.aggregate(pipeline).exec();

    const totals = res?.totals?.[0] || {};
    const byGroup: Record<string, { count: number; totalStock: number }> = {};
    if (res?.byGroup) {
      for (const item of res.byGroup) {
        byGroup[item._id] = {
          count: item.count,
          totalStock: item.totalStock,
        };
      }
    }

    return {
      totalMaterials: totals.totalMaterials || 0,
      lowStockCount: totals.lowStockCount || 0,
      byGroup,
      totalValuationPaise: totals.totalValuationPaise || 0,
    };
  }
}
