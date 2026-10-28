import mongoose from "mongoose";
import {
  MaterialModel,
  IMaterial,
  StockMovementModel,
  IStockMovement,
  PriceHistoryModel,
  IPriceHistory,
} from "./model.js";
import { StockMovementType } from "@loompilot/shared";

export class MaterialService {
  static async list(tenantId: string): Promise<IMaterial[]> {
    return MaterialModel.find({ tenantId }).sort({ name: 1 });
  }

  static async getById(tenantId: string, id: string): Promise<IMaterial | null> {
    return MaterialModel.findOne({ _id: id, tenantId });
  }

  static async create(data: Partial<IMaterial> & { tenantId: string }): Promise<IMaterial> {
    return MaterialModel.create(data);
  }

  static async recordMovement(
    tenantId: string,
    materialId: string,
    type: StockMovementType,
    quantity: number,
    referenceType: "receipt" | "order_issue" | "reservation" | "adjustment",
    referenceId?: string,
    notes?: string,
    session?: mongoose.ClientSession
  ): Promise<IStockMovement> {
    const material = await MaterialModel.findOne({ _id: materialId, tenantId }).session(session || null);
    if (!material) {
      throw new Error(`Material with ID ${materialId} not found`);
    }

    const previousBalance = material.onHandQuantity;
    let newBalance = previousBalance;

    if (type === StockMovementType.RECEIPT) {
      newBalance = previousBalance + quantity;
      material.onHandQuantity = newBalance;
    } else if (type === StockMovementType.ISSUE) {
      if (previousBalance < quantity) {
        throw new Error(`Insufficient stock: available ${previousBalance}, requested ${quantity}`);
      }
      newBalance = previousBalance - quantity;
      material.onHandQuantity = newBalance;
    } else if (type === StockMovementType.RESERVATION) {
      material.reservedQuantity = material.reservedQuantity + quantity;
    } else if (type === StockMovementType.RELEASE) {
      material.reservedQuantity = Math.max(0, material.reservedQuantity - quantity);
    } else if (type === StockMovementType.ADJUSTMENT) {
      newBalance = quantity;
      material.onHandQuantity = newBalance;
    }

    await material.save({ session });

    const movements = await StockMovementModel.create(
      [
        {
          tenantId,
          materialId: material._id,
          type,
          quantity,
          previousBalance,
          newBalance,
          referenceType,
          referenceId,
          notes,
        },
      ],
      { session }
    );

    return movements[0]!;
  }

  static async getMovements(tenantId: string, materialId: string): Promise<IStockMovement[]> {
    return StockMovementModel.find({ tenantId, materialId }).sort({ createdAt: -1 });
  }

  static async getPriceHistory(
    tenantId: string,
    materialId: string,
    limitDays = 90
  ): Promise<IPriceHistory[]> {
    return PriceHistoryModel.find({ tenantId, materialId })
      .sort({ date: -1 })
      .limit(limitDays);
  }
}

