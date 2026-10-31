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

  async createOrder(
    tenantId: string,
    data: {
      orderNumber: string;
      clientId: string;
      productId?: string;
      productDescription: string;
      quantity: number;
      deliveryDeadline: string;
      deliveryAddress?: string;
      spec: any;
      notes?: string;
      referenceFiles?: string[];
      actorId?: string;
    },
    tx?: TxContext
  ): Promise<IOrder> {
    const session = this.getSession(tx);
    const doc = new this.model({
      tenantId,
      orderNumber: data.orderNumber,
      clientId: new Types.ObjectId(data.clientId),
      productId: data.productId ? new Types.ObjectId(data.productId) : undefined,
      productDescription: data.productDescription,
      quantity: data.quantity,
      deliveryDeadline: data.deliveryDeadline,
      deliveryAddress: data.deliveryAddress,
      spec: data.spec,
      notes: data.notes,
      referenceFiles: data.referenceFiles?.map((id) => new Types.ObjectId(id)) || [],
      status: OrderStatus.SUBMITTED,
      statusHistory: [
        {
          status: OrderStatus.SUBMITTED,
          at: new Date(),
          by: data.actorId ? new Types.ObjectId(data.actorId) : undefined,
          reason: "Order submitted",
        },
      ],
      version: 1,
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
    feasibility: any,
    tx?: TxContext
  ): Promise<IOrder> {
    const session = this.getSession(tx);
    const feasibilityPayload = {
      ...feasibility,
      materialRequirements: feasibility.materialRequirements?.map((m: any) => ({
        ...m,
        materialId: typeof m.materialId === "string" ? new Types.ObjectId(m.materialId) : m.materialId,
      })),
    };
    const updated = await this.model
      .findOneAndUpdate(
        { tenantId, _id: orderId },
        { $set: { feasibility: feasibilityPayload }, $inc: { version: 1 } },
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

  async setQuotationClientPdfFileId(
    tenantId: string,
    orderId: string | Types.ObjectId,
    fileId: string,
    tx?: TxContext
  ): Promise<void> {
    const session = this.getSession(tx);
    await this.model.findOneAndUpdate(
      { tenantId, _id: orderId },
      {
        $set: { "quotation.clientPdfFileId": new Types.ObjectId(fileId) },
        $inc: { version: 1 },
      },
      { session: session ?? null }
    );
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
          $inc: { "production.deliveredQty": delivery.qty, version: 1 },
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

  async hasFileForSupervisor(
    tenantId: string,
    fileId: string,
    supervisorId: string
  ): Promise<boolean> {
    const count = await this.model.countDocuments({
      tenantId,
      "production.assignedSupervisors.supervisorId": new Types.ObjectId(supervisorId),
      referenceFiles: new Types.ObjectId(fileId),
    });
    return count > 0;
  }

  async assignSupervisors(
    tenantId: string,
    orderId: string | Types.ObjectId,
    assignedSupervisors: Array<{ supervisorId: Types.ObjectId; processArea: string; assignedAt?: Date }>,
    assignedBy?: Types.ObjectId,
    tx?: TxContext
  ): Promise<IOrder> {
    const session = this.getSession(tx);
    const updated = await this.model
      .findOneAndUpdate(
        { tenantId, _id: orderId },
        {
          $set: {
            "production.assignedSupervisors": assignedSupervisors,
            "production.assignedBy": assignedBy,
            "production.assignedAt": new Date(),
          },
          $inc: { version: 1 },
        },
        { new: true, session: session ?? null }
      )
      .lean<IOrder>()
      .exec();

    if (!updated) {
      throw new AppError(ErrorCode.NOT_FOUND, "Order not found", 404);
    }
    return updated;
  }

  async assignProduction(
    tenantId: string,
    orderId: string | Types.ObjectId,
    data: {
      assignedSupervisors: Array<{ supervisorId: Types.ObjectId; processes: string[]; acknowledgedAt?: Date }>;
      processPlan: any[];
      assignedBy?: Types.ObjectId;
    },
    tx?: TxContext
  ): Promise<IOrder> {
    const session = this.getSession(tx);
    const updated = await this.model
      .findOneAndUpdate(
        { tenantId, _id: orderId },
        {
          $set: {
            "production.assignedSupervisors": data.assignedSupervisors,
            "production.processPlan": data.processPlan,
            "production.assignmentStatus": "assigned",
            "production.assignedBy": data.assignedBy,
            "production.assignedAt": new Date(),
          },
          $inc: { version: 1 },
        },
        { new: true, session: session ?? null }
      )
      .lean<IOrder>()
      .exec();

    if (!updated) {
      throw new AppError(ErrorCode.NOT_FOUND, "Order not found", 404);
    }
    return updated;
  }

  async acknowledgeAndStartProduction(
    tenantId: string,
    orderId: string | Types.ObjectId,
    supervisorId?: string | Types.ObjectId,
    tx?: TxContext
  ): Promise<IOrder> {
    const session = this.getSession(tx);
    const filter: Record<string, any> = {
      tenantId,
      _id: orderId,
    };

    const update: Record<string, any> = {
      $set: {
        "production.assignmentStatus": "started",
      },
      $inc: { version: 1 },
    };

    const options: any = { new: true, session: session ?? null };

    if (supervisorId) {
      const sId = typeof supervisorId === "string" ? new Types.ObjectId(supervisorId) : supervisorId;
      filter["production.assignedSupervisors.supervisorId"] = sId;
      update.$set["production.assignedSupervisors.$[elem].acknowledgedAt"] = new Date();
      options.arrayFilters = [{ "elem.supervisorId": sId }];
    }

    const updated = await this.model
      .findOneAndUpdate(filter, update, options)
      .lean<IOrder>()
      .exec();

    if (!updated) {
      throw new AppError(ErrorCode.NOT_FOUND, "Order not found or supervisor not assigned", 404);
    }
    return updated;
  }

  async updatePurchaseDecisionReceipt(
    tenantId: string,
    orderId: string | Types.ObjectId,
    decisionId: string,
    receivedQty: number,
    tx?: TxContext
  ): Promise<IOrder | null> {
    const session = this.getSession(tx);
    const order = await this.model
      .findOne({
        tenantId,
        _id: orderId,
        "purchaseDecisions.decisionId": decisionId,
      })
      .session(session ?? null)
      .lean<IOrder>()
      .exec();

    if (!order) {
      return null;
    }

    const decision = order.purchaseDecisions?.find((d) => d.decisionId === decisionId);
    if (!decision) return null;

    const currentRecv = decision.supplierOrder?.recvQty || 0;
    const newRecv = currentRecv + receivedQty;
    const targetQty = decision.qty;
    const status = newRecv >= targetQty ? "received" : "partially_received";
    const now = new Date();

    return this.model
      .findOneAndUpdate(
        {
          tenantId,
          _id: orderId,
          "purchaseDecisions.decisionId": decisionId,
        },
        {
          $set: {
            "purchaseDecisions.$.supplierOrder.recvQty": newRecv,
            "purchaseDecisions.$.supplierOrder.status": status,
            "purchaseDecisions.$.supplierOrder.recvAt": now,
          },
          $inc: { version: 1 },
        },
        { new: true, session: session ?? null }
      )
      .lean<IOrder>()
      .exec();
  }

  async updateRevisionStatus(
    tenantId: string,
    orderId: string | Types.ObjectId,
    revisionNo: number,
    status: "accepted" | "declined",
    decision: { decision: string; reason?: string; at: Date },
    priceUpdates?: {
      totalPaise: number;
      unitPricePaise: number;
      etaDate?: string;
      paymentSchedule?: any[];
    },
    tx?: TxContext
  ): Promise<IOrder | null> {
    const session = this.getSession(tx);
    const update: Record<string, any> = {
      $set: {
        "quotation.revisions.$[elem].status": status,
        "quotation.revisions.$[elem].clientDecision": decision,
      },
      $inc: { version: 1 },
    };

    if (priceUpdates) {
      update.$set["quotation.totalPaise"] = priceUpdates.totalPaise;
      update.$set["quotation.unitPricePaise"] = priceUpdates.unitPricePaise;
      if (priceUpdates.etaDate) {
        update.$set["quotation.etaDate"] = priceUpdates.etaDate;
      }
      if (priceUpdates.paymentSchedule) {
        update.$set["quotation.paymentSchedule"] = priceUpdates.paymentSchedule;
      }
    }

    return this.model
      .findOneAndUpdate(
        {
          tenantId,
          _id: orderId,
          "quotation.revisions": {
            $elemMatch: { revisionNo, status: { $in: ["sent", "proposed", "approved"] } },
          },
        },
        update,
        {
          arrayFilters: [{ "elem.revisionNo": revisionNo }],
          new: true,
          session: session ?? null,
        }
      )
      .lean<IOrder>()
      .exec();
  }

  async setMilestoneRazorpayOrderId(
    tenantId: string,
    orderId: string | Types.ObjectId,
    milestoneIndex: number,
    razorpayOrderId: string,
    tx?: TxContext
  ): Promise<IOrder> {
    const session = this.getSession(tx);
    const updated = await this.model
      .findOneAndUpdate(
        { tenantId, _id: orderId },
        {
          $set: {
            [`financials.milestones.${milestoneIndex}.razorpayOrderId`]: razorpayOrderId,
          },
          $inc: { version: 1 },
        },
        { new: true, session: session ?? null }
      )
      .lean<IOrder>()
      .exec();

    if (!updated) {
      throw new AppError(ErrorCode.NOT_FOUND, "Order not found", 404);
    }
    return updated;
  }

  async reversePaymentReceipt(
    tenantId: string,
    orderId: string | Types.ObjectId,
    milestoneIndex: number,
    receiptIndex: number,
    reason: string,
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

    const receipt = milestone.receipts?.[receiptIndex];
    if (!receipt) {
      throw new AppError(
        ErrorCode.NOT_FOUND,
        `Receipt index ${receiptIndex} not found on milestone`,
        404
      );
    }

    if (receipt.reversedAt) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, "Payment receipt is already reversed", 400);
    }

    const revAmount = receipt.amountPaise;
    const isAdvance = milestone.trigger === "advance";
    const currentReceived = milestone.receivedPaise || 0;
    const newReceived = Math.max(0, currentReceived - revAmount);
    const newStatus = newReceived <= 0 ? "pending" : "partial";

    const updateOps: Record<string, any> = {
      $set: {
        [`financials.milestones.${milestoneIndex}.receipts.${receiptIndex}.reversedAt`]: new Date(),
        [`financials.milestones.${milestoneIndex}.receipts.${receiptIndex}.reversalReason`]: reason,
        [`financials.milestones.${milestoneIndex}.status`]: newStatus,
        [`financials.milestones.${milestoneIndex}.receivedPaise`]: newReceived,
      },
      $inc: {
        "financials.totalPaidPaise": -revAmount,
        version: 1,
      },
    };

    if (isAdvance) {
      updateOps.$inc["financials.advanceReceivedPaise"] = -revAmount;
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

  async findByRazorpayOrderId(razorpayOrderId: string): Promise<IOrder | null> {
    return this.model
      .findOne({ "financials.milestones.razorpayOrderId": razorpayOrderId })
      .lean<IOrder>()
      .exec();
  }

  async findOrdersWithOverdueMilestones(tenantId?: string, todayDate?: string): Promise<IOrder[]> {
    const today = todayDate || new Date().toISOString().split("T")[0]!;
    const filter: Record<string, any> = {
      status: {
        $in: ["client_accepted", "assigned", "in_production", "ready_for_delivery", "partially_delivered"],
      },
      "financials.milestones": {
        $elemMatch: {
          status: { $in: ["pending", "partial"] },
          dueDate: { $lt: today },
        },
      },
    };
    if (tenantId) filter.tenantId = tenantId;
    return this.model.find(filter).lean<IOrder[]>().exec();
  }

  async setMilestoneOverdue(
    tenantId: string,
    orderId: string | Types.ObjectId,
    milestoneIndex: number,
    tx?: TxContext
  ): Promise<IOrder | null> {
    const session = this.getSession(tx);
    return this.model
      .findOneAndUpdate(
        {
          tenantId,
          _id: orderId,
          [`financials.milestones.${milestoneIndex}.status`]: { $in: ["pending", "partial"] },
        },
        {
          $set: {
            [`financials.milestones.${milestoneIndex}.status`]: "overdue",
          },
          $inc: { version: 1 },
        },
        { new: true, session: session ?? null }
      )
      .lean<IOrder>()
      .exec();
  }

  async updateFinancials(
    tenantId: string,
    orderId: string | Types.ObjectId,
    updates: {
      advanceReceivedPaise?: number;
      totalPaidPaise?: number;
      totalInvoicedPaise?: number;
    },
    tx?: TxContext
  ): Promise<IOrder> {
    const session = this.getSession(tx);
    const setFields: Record<string, any> = {};
    if (updates.advanceReceivedPaise !== undefined) {
      setFields["financials.advanceReceivedPaise"] = updates.advanceReceivedPaise;
    }
    if (updates.totalPaidPaise !== undefined) {
      setFields["financials.totalPaidPaise"] = updates.totalPaidPaise;
    }
    if (updates.totalInvoicedPaise !== undefined) {
      setFields["financials.totalInvoicedPaise"] = updates.totalInvoicedPaise;
    }

    const updated = await this.model
      .findOneAndUpdate(
        { tenantId, _id: orderId },
        { $set: setFields, $inc: { version: 1 } },
        { new: true, session: session ?? null }
      )
      .lean<IOrder>()
      .exec();

    if (!updated) {
      throw new AppError(ErrorCode.NOT_FOUND, "Order not found", 404);
    }
    return updated;
  }

  async releaseReservations(
    tenantId: string,
    orderId: string | Types.ObjectId,
    tx?: TxContext
  ): Promise<IOrder> {
    const session = this.getSession(tx);
    const updated = await this.model
      .findOneAndUpdate(
        { tenantId, _id: orderId },
        {
          $set: { "reservations.$[].status": "released" },
          $inc: { version: 1 },
        },
        { new: true, session: session ?? null }
      )
      .lean<IOrder>()
      .exec();

    if (!updated) {
      throw new AppError(ErrorCode.NOT_FOUND, "Order not found", 404);
    }
    return updated;
  }

  async isProcessAreaUsedInActiveOrders(tenantId: string, area: string): Promise<boolean> {
    const count = await this.model.countDocuments({
      tenantId,
      status: { $nin: ["delivered", "completed", "cancelled"] },
      $or: [
        { "quotation.plan.stage": area },
        { "production.stageTotals.stage": area },
      ],
    });
    return count > 0;
  }
}

