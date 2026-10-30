import mongoose, { ClientSession, Types } from "mongoose";
import { OrderModel, IOrder } from "../models/orders/order.model.js";
import { TxContext } from "../interfaces/unit-of-work.interface.js";
import { AppError } from "../errors/app-error.js";
import {
  ErrorCode,
  OrderStatus,
  assertTransition,
} from "@loompilot/shared";
import { PaginationQuery, PaginatedResult, createPaginationMeta } from "../utils/pagination.js";

/**
 * Stage 3.5: OrdersRepository
 *
 * Architectural Invariants:
 * 1. Allowlist projection constants only (costing is NEVER projected by OrdersRepository).
 * 2. Field-scoped atomic update methods only (NO save() or blanket document overwriting).
 * 3. Strict array capping enforcement throwing CAP_EXCEEDED (revisions, milestones, deliveries, etc.).
 * 4. Multi-tenancy isolation strictly enforced on every query.
 */

// Allowlist Projections
export const ORDER_SUMMARY_PROJECTION = {
  _id: 1,
  tenantId: 1,
  orderNumber: 1,
  clientId: 1,
  productId: 1,
  productDescription: 1,
  quantity: 1,
  deliveryDeadline: 1,
  status: 1,
  "production.phase": 1,
  "production.percentComplete": 1,
  "production.producedQty": 1,
  createdAt: 1,
  updatedAt: 1,
} as const;

export const ORDER_DETAIL_PROJECTION = {
  _id: 1,
  tenantId: 1,
  orderNumber: 1,
  clientId: 1,
  productId: 1,
  productDescription: 1,
  quantity: 1,
  deliveryDeadline: 1,
  status: 1,
  spec: 1,
  estimatedCompletionDate: 1,
  statusHistory: 1,
  source: 1,
  requestVersion: 1,
  parentOrderId: 1,
  deliveryAddress: 1,
  deliveryNotes: 1,
  referenceFiles: 1,
  idempotencyKey: 1,
  feasibility: 1,
  quotation: 1,
  // costing is STRICTLY EXCLUDED (select: false reserved for AdminCostingRepository)
  purchaseDecisions: 1,
  reservations: 1,
  production: 1,
  financials: 1,
  deliveries: 1,
  createdAt: 1,
  updatedAt: 1,
  version: 1,
} as const;

export const CLIENT_SAFE_ORDER_PROJECTION = {
  _id: 1,
  tenantId: 1,
  orderNumber: 1,
  status: 1,
  quantity: 1,
  deliveryDeadline: 1,
  spec: 1,
  estimatedCompletionDate: 1,
  "quotation.unitPrice": 1,
  "quotation.totalPaise": 1,
  "quotation.etaDate": 1,
  "quotation.clientExplanation": 1,
  "quotation.termsVersion": 1,
  "quotation.priceVariationClause": 1,
  "production.phase": 1,
  "production.percentComplete": 1,
  "financials.advanceReceivedPaise": 1,
  "financials.totalPaidPaise": 1,
  deliveries: 1,
  createdAt: 1,
} as const;

export const SUPERVISOR_ORDER_PROJECTION = {
  _id: 1,
  tenantId: 1,
  orderNumber: 1,
  clientId: 1,
  productId: 1,
  productDescription: 1,
  quantity: 1,
  deliveryDeadline: 1,
  status: 1,
  spec: 1,
  estimatedCompletionDate: 1,
  statusHistory: 1,
  production: 1,
  deliveries: 1,
  createdAt: 1,
  updatedAt: 1,
  version: 1,
} as const;

// Caps defined in Schema v4 specification
export const ORDER_CAPS = {
  STATUS_HISTORY: 200,
  REVISIONS: 20,
  MILESTONES: 12,
  RECEIPTS_PER_MILESTONE: 50,
  DELIVERIES: 50,
  PURCHASE_DECISIONS: 50,
  RESERVATIONS: 50,
} as const;

export class OrdersRepository {
  constructor(private readonly model: mongoose.Model<IOrder> = OrderModel) {}

  private getSession(tx?: TxContext): ClientSession | undefined {
    return tx?.session as ClientSession | undefined;
  }

  async create(
    tenantId: string,
    data: Partial<IOrder>,
    tx?: TxContext
  ): Promise<IOrder> {
    const session = this.getSession(tx);
    const doc = new this.model({
      ...data,
      tenantId,
      status: data.status || OrderStatus.SUBMITTED,
    });
    return doc.save({ session });
  }

  async findById(
    tenantId: string,
    orderId: string | Types.ObjectId,
    projection: Record<string, any> = ORDER_DETAIL_PROJECTION,
    tx?: TxContext
  ): Promise<IOrder | null> {
    const session = this.getSession(tx);
    return this.model
      .findOne({ tenantId, _id: orderId }, projection)
      .session(session ?? null)
      .lean<IOrder>()
      .exec();
  }

  async findByOrderNumber(
    tenantId: string,
    orderNumber: string,
    projection: Record<string, any> = ORDER_DETAIL_PROJECTION,
    tx?: TxContext
  ): Promise<IOrder | null> {
    const session = this.getSession(tx);
    return this.model
      .findOne({ tenantId, orderNumber: orderNumber.toUpperCase().trim() }, projection)
      .session(session ?? null)
      .lean<IOrder>()
      .exec();
  }

  async findPaginated(
    tenantId: string,
    filter: Record<string, any> = {},
    pagination: PaginationQuery,
    projection: Record<string, any> = ORDER_SUMMARY_PROJECTION,
    tx?: TxContext
  ): Promise<PaginatedResult<IOrder>> {
    const session = this.getSession(tx);
    const queryFilter = { ...filter, tenantId };
    const page = Math.max(1, pagination.page || 1);
    const limit = Math.min(100, Math.max(1, pagination.limit || 20));
    const skip = (page - 1) * limit;

    const [items, totalItems] = await Promise.all([
      this.model
        .find(queryFilter, projection)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .session(session ?? null)
        .lean<IOrder[]>()
        .exec(),
      this.model.countDocuments(queryFilter).session(session ?? null).exec(),
    ]);

    return {
      data: items,
      meta: createPaginationMeta(totalItems, page, limit),
    };
  }

  // -------------------------------------------------------------------------
  // Field-Scoped Atomic Update Methods Only (No blanket save() or update())
  // -------------------------------------------------------------------------

  async updateStatus(
    tenantId: string,
    orderId: string | Types.ObjectId,
    toStatus: OrderStatus,
    context?: { role?: "admin" | "supervisor"; reason?: string; by?: Types.ObjectId },
    tx?: TxContext
  ): Promise<IOrder> {
    const session = this.getSession(tx);
    const order = await this.model
      .findOne({ tenantId, _id: orderId })
      .session(session ?? null)
      .exec();

    if (!order) {
      throw new AppError(ErrorCode.NOT_FOUND, "Order not found", 404);
    }

    // Enforce S4 transition rules with context safeguards
    assertTransition("order", order.status, toStatus, context);

    // Enforce history cap
    if ((order.statusHistory?.length || 0) >= ORDER_CAPS.STATUS_HISTORY) {
      throw new AppError(
        ErrorCode.CAP_EXCEEDED,
        `Status history cap of ${ORDER_CAPS.STATUS_HISTORY} exceeded`,
        400
      );
    }

    const historyEntry = {
      status: toStatus,
      by: context?.by,
      at: new Date(),
      reason: context?.reason,
    };

    const updated = await this.model
      .findOneAndUpdate(
        { tenantId, _id: orderId, status: order.status },
        {
          $set: { status: toStatus },
          $push: { statusHistory: historyEntry },
          $inc: { version: 1 },
        },
        { new: true, session: session ?? null }
      )
      .lean<IOrder>()
      .exec();

    if (!updated) {
      throw new AppError(
        ErrorCode.VERSION_CONFLICT,
        "Concurrent status update conflict: order status has changed",
        409
      );
    }

    return updated;
  }

  async setFeasibility(
    tenantId: string,
    orderId: string | Types.ObjectId,
    feasibility: NonNullable<IOrder["feasibility"]>,
    tx?: TxContext
  ): Promise<IOrder> {
    const session = this.getSession(tx);
    const updated = await this.model
      .findOneAndUpdate(
        { tenantId, _id: orderId },
        { $set: { feasibility }, $inc: { version: 1 } },
        { new: true, session: session ?? null }
      )
      .lean<IOrder>()
      .exec();

    if (!updated) {
      throw new AppError(ErrorCode.NOT_FOUND, "Order not found", 404);
    }
    return updated;
  }

  async setQuotation(
    tenantId: string,
    orderId: string | Types.ObjectId,
    quotation: NonNullable<IOrder["quotation"]>,
    expected?: { version?: number; status?: OrderStatus | string },
    tx?: TxContext
  ): Promise<IOrder> {
    const session = this.getSession(tx);
    const filter: Record<string, any> = { tenantId, _id: orderId };
    if (expected?.version !== undefined) {
      filter["quotation.version"] = expected.version;
    }
    if (expected?.status !== undefined) {
      filter["status"] = expected.status;
    }

    const updated = await this.model
      .findOneAndUpdate(
        filter,
        { $set: { quotation }, $inc: { version: 1 } },
        { new: true, session: session ?? null }
      )
      .lean<IOrder>()
      .exec();

    if (!updated) {
      const exists = await this.model.exists({ tenantId, _id: orderId });
      if (!exists) {
        throw new AppError(ErrorCode.NOT_FOUND, "Order not found", 404);
      }
      throw new AppError(
        ErrorCode.VERSION_CONFLICT,
        "Quotation update conflict: version or order status has changed",
        409
      );
    }
    return updated;
  }

  async addQuotationRevision(
    tenantId: string,
    orderId: string | Types.ObjectId,
    revision: any,
    tx?: TxContext
  ): Promise<IOrder> {
    const session = this.getSession(tx);
    const order = await this.model
      .findOne({ tenantId, _id: orderId })
      .session(session ?? null)
      .exec();

    if (!order) {
      throw new AppError(ErrorCode.NOT_FOUND, "Order not found", 404);
    }

    const currentRevisions = order.quotation?.revisions || [];
    if (currentRevisions.length >= ORDER_CAPS.REVISIONS) {
      throw new AppError(
        ErrorCode.CAP_EXCEEDED,
        `Quotation revisions cap of ${ORDER_CAPS.REVISIONS} exceeded`,
        400
      );
    }

    const updated = await this.model
      .findOneAndUpdate(
        { tenantId, _id: orderId },
        {
          $push: { "quotation.revisions": revision },
          $inc: { version: 1 },
        },
        { new: true, session: session ?? null }
      )
      .lean<IOrder>()
      .exec();

    return updated!;
  }

  async updateProductionProgress(
    tenantId: string,
    orderId: string | Types.ObjectId,
    progress: {
      phase?: string;
      percentComplete?: number;
      producedQty?: number;
      stageTotals?: any[];
      activeMachines?: any[];
    },
    tx?: TxContext
  ): Promise<IOrder> {
    const session = this.getSession(tx);
    const updateOps: Record<string, any> = {};

    if (progress.phase !== undefined) updateOps["production.phase"] = progress.phase;
    if (progress.percentComplete !== undefined)
      updateOps["production.percentComplete"] = progress.percentComplete;
    if (progress.producedQty !== undefined)
      updateOps["production.producedQty"] = progress.producedQty;
    if (progress.stageTotals !== undefined)
      updateOps["production.stageTotals"] = progress.stageTotals;
    if (progress.activeMachines !== undefined)
      updateOps["production.activeMachines"] = progress.activeMachines;

    const updated = await this.model
      .findOneAndUpdate(
        { tenantId, _id: orderId },
        { $set: updateOps, $inc: { version: 1 } },
        { new: true, session: session ?? null }
      )
      .lean<IOrder>()
      .exec();

    if (!updated) {
      throw new AppError(ErrorCode.NOT_FOUND, "Order not found", 404);
    }
    return updated;
  }

  async addMilestone(
    tenantId: string,
    orderId: string | Types.ObjectId,
    milestone: any,
    tx?: TxContext
  ): Promise<IOrder> {
    const session = this.getSession(tx);
    const order = await this.model
      .findOne({ tenantId, _id: orderId })
      .session(session ?? null)
      .exec();

    if (!order) {
      throw new AppError(ErrorCode.NOT_FOUND, "Order not found", 404);
    }

    const currentMilestones = order.financials?.milestones || [];
    if (currentMilestones.length >= ORDER_CAPS.MILESTONES) {
      throw new AppError(
        ErrorCode.CAP_EXCEEDED,
        `Payment milestones cap of ${ORDER_CAPS.MILESTONES} exceeded`,
        400
      );
    }

    const updated = await this.model
      .findOneAndUpdate(
        { tenantId, _id: orderId },
        {
          $push: { "financials.milestones": milestone },
          $inc: { version: 1 },
        },
        { new: true, session: session ?? null }
      )
      .lean<IOrder>()
      .exec();

    return updated!;
  }

  async recordPaymentReceipt(
    tenantId: string,
    orderId: string | Types.ObjectId,
    milestoneIndex: number,
    receipt: any,
    tx?: TxContext
  ): Promise<IOrder> {
    const session = this.getSession(tx);
    const order = await this.model
      .findOne({ tenantId, _id: orderId })
      .session(session ?? null)
      .exec();

    if (!order) {
      throw new AppError(ErrorCode.NOT_FOUND, "Order not found", 404);
    }

    const milestone = order.financials?.milestones?.[milestoneIndex];
    if (!milestone) {
      throw new AppError(ErrorCode.NOT_FOUND, `Milestone index ${milestoneIndex} not found`, 404);
    }

    if ((milestone.receipts?.length || 0) >= ORDER_CAPS.RECEIPTS_PER_MILESTONE) {
      throw new AppError(
        ErrorCode.CAP_EXCEEDED,
        `Receipts cap of ${ORDER_CAPS.RECEIPTS_PER_MILESTONE} per milestone exceeded`,
        400
      );
    }

    // Deduplication safeguard: conditional update if razorpayPaymentId is present
    if (receipt.razorpayPaymentId) {
      const alreadyRecorded = milestone.receipts?.some(
        (r: any) => r.razorpayPaymentId === receipt.razorpayPaymentId
      );
      if (alreadyRecorded) {
        throw new AppError(
          ErrorCode.DUPLICATE,
          `Payment receipt with Razorpay ID ${receipt.razorpayPaymentId} already recorded`,
          409
        );
      }
    }

    const newReceivedPaise = (milestone.receivedPaise || 0) + receipt.amountPaise;
    const isAdvance = milestone.trigger === "advance";

    const updateOps: Record<string, any> = {
      $push: { [`financials.milestones.${milestoneIndex}.receipts`]: receipt },
      $inc: {
        "financials.totalPaidPaise": receipt.amountPaise,
        [`financials.milestones.${milestoneIndex}.receivedPaise`]: receipt.amountPaise,
        version: 1,
      },
    };

    if (isAdvance) {
      updateOps.$inc["financials.advanceReceivedPaise"] = receipt.amountPaise;
    }

    if (newReceivedPaise >= milestone.amountPaise) {
      updateOps.$set = { [`financials.milestones.${milestoneIndex}.status`]: "received" };
    } else {
      updateOps.$set = { [`financials.milestones.${milestoneIndex}.status`]: "partial" };
    }

    const updated = await this.model
      .findOneAndUpdate({ tenantId, _id: orderId }, updateOps, {
        new: true,
        session: session ?? null,
      })
      .lean<IOrder>()
      .exec();

    return updated!;
  }

  async addDelivery(
    tenantId: string,
    orderId: string | Types.ObjectId,
    delivery: any,
    tx?: TxContext
  ): Promise<IOrder> {
    const session = this.getSession(tx);
    const order = await this.model
      .findOne({ tenantId, _id: orderId })
      .session(session ?? null)
      .exec();

    if (!order) {
      throw new AppError(ErrorCode.NOT_FOUND, "Order not found", 404);
    }

    if ((order.deliveries?.length || 0) >= ORDER_CAPS.DELIVERIES) {
      throw new AppError(
        ErrorCode.CAP_EXCEEDED,
        `Deliveries cap of ${ORDER_CAPS.DELIVERIES} exceeded`,
        400
      );
    }

    const updated = await this.model
      .findOneAndUpdate(
        { tenantId, _id: orderId },
        {
          $push: { deliveries: delivery },
          $inc: { version: 1 },
        },
        { new: true, session: session ?? null }
      )
      .lean<IOrder>()
      .exec();

    return updated!;
  }

  async addPurchaseDecision(
    tenantId: string,
    orderId: string | Types.ObjectId,
    decision: any,
    tx?: TxContext
  ): Promise<IOrder> {
    const session = this.getSession(tx);
    const order = await this.model
      .findOne({ tenantId, _id: orderId })
      .session(session ?? null)
      .exec();

    if (!order) {
      throw new AppError(ErrorCode.NOT_FOUND, "Order not found", 404);
    }

    if ((order.purchaseDecisions?.length || 0) >= ORDER_CAPS.PURCHASE_DECISIONS) {
      throw new AppError(
        ErrorCode.CAP_EXCEEDED,
        `Purchase decisions cap of ${ORDER_CAPS.PURCHASE_DECISIONS} exceeded`,
        400
      );
    }

    const updated = await this.model
      .findOneAndUpdate(
        { tenantId, _id: orderId },
        {
          $push: { purchaseDecisions: decision },
          $inc: { version: 1 },
        },
        { new: true, session: session ?? null }
      )
      .lean<IOrder>()
      .exec();

    return updated!;
  }

  async addReservation(
    tenantId: string,
    orderId: string | Types.ObjectId,
    reservation: any,
    tx?: TxContext
  ): Promise<IOrder> {
    const session = this.getSession(tx);
    const order = await this.model
      .findOne({ tenantId, _id: orderId })
      .session(session ?? null)
      .exec();

    if (!order) {
      throw new AppError(ErrorCode.NOT_FOUND, "Order not found", 404);
    }

    if ((order.reservations?.length || 0) >= ORDER_CAPS.RESERVATIONS) {
      throw new AppError(
        ErrorCode.CAP_EXCEEDED,
        `Reservations cap of ${ORDER_CAPS.RESERVATIONS} exceeded`,
        400
      );
    }

    const updated = await this.model
      .findOneAndUpdate(
        { tenantId, _id: orderId },
        {
          $push: { reservations: reservation },
          $inc: { version: 1 },
        },
        { new: true, session: session ?? null }
      )
      .lean<IOrder>()
      .exec();

    return updated!;
  }
}

