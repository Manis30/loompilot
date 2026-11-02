import mongoose, { ClientSession, Types } from "mongoose";
import { OrderModel, ICosting } from "../models/orders/order.model.js";
import { TxContext } from "../interfaces/unit-of-work.interface.js";
import { AppError } from "../errors/app-error.js";
import { ErrorCode } from "@loompilot/shared";

/**
 * Stage 3.5: AdminCostingRepository
 *
 * Dedicated repository strictly for administrator access to internal order costing sheets.
 * Since `costing` is defined with `select: false` on OrderSchema, only this repository
 * explicitly projects `+costing` to protect sensitive manufacturing margin drivers from leaking.
 */
export class AdminCostingRepository {
  constructor(private readonly model: mongoose.Model<any> = OrderModel) {}

  private getSession(tx?: TxContext): ClientSession | undefined {
    return tx?.session as ClientSession | undefined;
  }

  async getCosting(
    tenantId: string,
    orderId: string | Types.ObjectId,
    tx?: TxContext
  ): Promise<ICosting | null> {
    const session = this.getSession(tx);
    const order = await this.model
      .findOne({ tenantId, _id: orderId }, { costing: 1, tenantId: 1, orderNumber: 1 })
      .select("+costing")
      .session(session ?? null)
      .lean<any>()
      .exec();

    if (!order) {
      throw new AppError(ErrorCode.NOT_FOUND, "Order not found", 404);
    }

    return order.costing || null;
  }

  async updateCosting(
    tenantId: string,
    orderId: string | Types.ObjectId,
    costing: any,
    tx?: TxContext
  ): Promise<ICosting> {
    const session = this.getSession(tx);
    const totalCost = costing.totalCostPaise || (costing.subtotalCostPaise || 0) + (costing.overheadCostPaise || 0);
    const mapped = {
      ...costing,
      totalCostPaise: totalCost,
      materialCosts: costing.materialCosts?.map((m: any) => ({
        ...m,
        materialId: typeof m.materialId === "string" ? new Types.ObjectId(m.materialId) : m.materialId,
      })),
    };
    const updated = await this.model
      .findOneAndUpdate(
        { tenantId, _id: orderId },
        { $set: { costing: mapped }, $inc: { version: 1 } },
        { new: true, session: session ?? null }
      )
      .select("+costing")
      .lean<any>()
      .exec();

    if (!updated) {
      throw new AppError(ErrorCode.NOT_FOUND, "Order not found", 404);
    }

    return updated.costing;
  }
}

