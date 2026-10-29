import { StockInsufficientError, NotFoundError } from "../errors/index.js";
import {
  IMaterialRepository,
  Material,
  NewMaterial,
  StockMovement,
  NewStockMovement,
  Reservation,
  NewReservation,
  PriceHistory,
  NewPriceHistory,
} from "../interfaces/material.repository.js";
import { TxContext } from "../interfaces/unit-of-work.js";
import { ListQuery, Page, toPage } from "../utils/pagination.js";
import {
  MaterialModel,
  StockMovementModel,
  ReservationModel,
  PriceHistoryModel,
} from "../models/material.model.js";

export class MongoMaterialRepository implements IMaterialRepository {
  private toMaterial(doc: any): Material {
    return {
      id: doc._id.toString(),
      tenantId: doc.tenantId,
      code: doc.code,
      name: doc.name,
      type: doc.type,
      unit: doc.unit,
      currentRatePaise: doc.currentRatePaise,
      avgCostPaise: doc.avgCostPaise,
      onHandQuantity: doc.onHandQuantity,
      reservedQuantity: doc.reservedQuantity,
      reorderLevel: doc.reorderLevel,
      preferredSupplierId: doc.preferredSupplierId ? doc.preferredSupplierId.toString() : undefined,
      active: doc.active ?? true,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  private toMovement(doc: any): StockMovement {
    return {
      id: doc._id.toString(),
      tenantId: doc.tenantId,
      materialId: doc.materialId.toString(),
      type: doc.type,
      quantity: doc.quantity,
      previousBalance: doc.previousBalance,
      newBalance: doc.newBalance,
      referenceType: doc.referenceType,
      referenceId: doc.referenceId,
      notes: doc.notes,
      createdAt: doc.createdAt,
    };
  }

  private toReservation(doc: any): Reservation {
    return {
      id: doc._id.toString(),
      tenantId: doc.tenantId,
      materialId: doc.materialId.toString(),
      orderId: doc.orderId.toString(),
      quantity: doc.quantity,
      status: doc.status,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  private toPriceHistory(doc: any): PriceHistory {
    return {
      id: doc._id.toString(),
      tenantId: doc.tenantId,
      materialId: doc.materialId.toString(),
      date: doc.date,
      ratePaise: doc.ratePaise,
      source: doc.source,
      createdAt: doc.createdAt,
    };
  }

  async create(data: NewMaterial, tx?: TxContext): Promise<Material> {
    const docs = await MaterialModel.create([data], { session: tx?.session || null });
    return this.toMaterial(docs[0]!);
  }

  async findById(tenantId: string, id: string, tx?: TxContext): Promise<Material | null> {
    const doc = await MaterialModel.findOne({ _id: id, tenantId })
      .session(tx?.session || null)
      .lean();
    return doc ? this.toMaterial(doc) : null;
  }

  async findByCode(tenantId: string, code: string, tx?: TxContext): Promise<Material | null> {
    const doc = await MaterialModel.findOne({ tenantId, code })
      .session(tx?.session || null)
      .lean();
    return doc ? this.toMaterial(doc) : null;
  }

  async update(
    tenantId: string,
    id: string,
    data: Partial<Material>,
    tx?: TxContext
  ): Promise<Material | null> {
    const doc = await MaterialModel.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: data },
      { new: true, session: tx?.session || null }
    ).lean();
    return doc ? this.toMaterial(doc) : null;
  }

  async list(tenantId: string, query?: ListQuery): Promise<Page<Material>> {
    const page = query?.page || 1;
    const limit = query?.limit || 50;
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      MaterialModel.find({ tenantId })
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      MaterialModel.countDocuments({ tenantId }),
    ]);

    return toPage(
      docs.map((d) => this.toMaterial(d)),
      total,
      page,
      limit
    );
  }

  async recordMovement(data: NewStockMovement, tx?: TxContext): Promise<StockMovement> {
    const docs = await StockMovementModel.create([data], { session: tx?.session || null });
    return this.toMovement(docs[0]!);
  }

  async getMovements(tenantId: string, materialId: string): Promise<StockMovement[]> {
    const docs = await StockMovementModel.find({ tenantId, materialId })
      .sort({ createdAt: -1 })
      .lean();
    return docs.map((d) => this.toMovement(d));
  }

  async createReservation(data: NewReservation, tx?: TxContext): Promise<Reservation> {
    const docs = await ReservationModel.create([data], { session: tx?.session || null });
    return this.toReservation(docs[0]!);
  }

  async findReservation(
    tenantId: string,
    orderId: string,
    materialId: string,
    tx?: TxContext
  ): Promise<Reservation | null> {
    const doc = await ReservationModel.findOne({ tenantId, orderId, materialId })
      .session(tx?.session || null)
      .lean();
    return doc ? this.toReservation(doc) : null;
  }

  async updateReservationStatus(
    tenantId: string,
    id: string,
    status: "reserved" | "allocated" | "released",
    tx?: TxContext
  ): Promise<void> {
    await ReservationModel.updateOne(
      { _id: id, tenantId },
      { $set: { status } },
      { session: tx?.session || null }
    );
  }

  async recordPrice(data: NewPriceHistory, tx?: TxContext): Promise<PriceHistory> {
    const docs = await PriceHistoryModel.create([data], { session: tx?.session || null });
    return this.toPriceHistory(docs[0]!);
  }

  async getPriceHistory(
    tenantId: string,
    materialId: string,
    limitDays = 90
  ): Promise<PriceHistory[]> {
    const docs = await PriceHistoryModel.find({ tenantId, materialId })
      .sort({ date: -1 })
      .limit(limitDays)
      .lean();
    return docs.map((d) => this.toPriceHistory(d));
  }

  async mutateStock(
    tenantId: string,
    id: string,
    onHandChange: number,
    reservedChange: number,
    tx?: TxContext
  ): Promise<Material> {
    const filter: any = { _id: id, tenantId };

    if (onHandChange < 0) {
      filter.onHandQuantity = { $gte: -onHandChange };
    }
    if (reservedChange < 0) {
      filter.reservedQuantity = { $gte: -reservedChange };
    }

    const doc = await MaterialModel.findOneAndUpdate(
      filter,
      {
        $inc: {
          onHandQuantity: onHandChange,
          reservedQuantity: reservedChange,
        },
      },
      { new: true, session: tx?.session || null }
    ).lean();

    if (!doc) {
      const exists = await MaterialModel.findOne({ _id: id, tenantId }).session(
        tx?.session || null
      );
      if (exists) {
        throw new StockInsufficientError(
          `Insufficient stock or reserved stock for material '${exists.name}' (${exists.code})`
        );
      }
      throw new NotFoundError(`Material with ID ${id} not found`);
    }

    return this.toMaterial(doc);
  }

  async getStockSummary(tenantId: string): Promise<
    Array<{
      id: string;
      code: string;
      name: string;
      unit: string;
      onHandQuantity: number;
      reservedQuantity: number;
      availableQuantity: number;
      avgCostPaise: number;
      totalValuePaise: number;
    }>
  > {
    const docs = await MaterialModel.find({ tenantId, active: true })
      .sort({ code: 1 })
      .lean();

    return docs.map((m: any) => ({
      id: m._id.toString(),
      code: m.code,
      name: m.name,
      unit: m.unit,
      onHandQuantity: m.onHandQuantity,
      reservedQuantity: m.reservedQuantity,
      availableQuantity: Math.max(0, m.onHandQuantity - m.reservedQuantity),
      avgCostPaise: m.avgCostPaise,
      totalValuePaise: Math.round(m.onHandQuantity * m.avgCostPaise),
    }));
  }

  async appendPriceHistory(
    tenantId: string,
    materialId: string,
    effectiveDate: string,
    ratePaise: number,
    source: string,
    referenceId?: string,
    tx?: TxContext
  ): Promise<PriceHistory> {
    const docs = await PriceHistoryModel.create(
      [
        {
          tenantId,
          materialId,
          date: effectiveDate,
          ratePaise,
          source,
          referenceId,
        },
      ],
      { session: tx?.session || null }
    );
    return this.toPriceHistory(docs[0]!);
  }

  async backfillPriceHistory(
    tenantId: string,
    materialId: string,
    entries: Array<{ date: string; ratePaise: number; source?: string }>
  ): Promise<number> {
    if (!entries.length) return 0;
    const docs = entries.map((e) => ({
      tenantId,
      materialId,
      date: e.date,
      ratePaise: e.ratePaise,
      source: e.source || "backfill",
    }));
    await PriceHistoryModel.insertMany(docs);
    return docs.length;
  }
}

