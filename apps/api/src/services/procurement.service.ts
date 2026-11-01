import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import { OrdersRepository, ORDER_CAPS } from "../repositories/orders.repository.js";
import { MaterialRepository } from "../repositories/material.repository.js";
import { SupplierRepository } from "../repositories/supplier.repository.js";
import { AuditService } from "./audit.service.js";
import { PaginationQuery } from "../utils/pagination.js";
import { AppError } from "../errors/app-error.js";
import { ErrorCode } from "@loompilot/shared";

export class ProcurementService {
  constructor(
    private readonly ordersRepo = new OrdersRepository(),
    private readonly materialRepo = new MaterialRepository(),
    private readonly supplierRepo = new SupplierRepository(),
    private readonly auditService = new AuditService()
  ) {}

  async createPurchaseDecision(params: {
    tenantId: string;
    orderId: string;
    actor: { id: string; email?: string; ip?: string; requestId?: string };
    data: {
      decisionId?: string;
      optionId?: string;
      materialId: string;
      supplierId?: string;
      qty: number;
      ratePaise?: number;
      expectedArrivalDate?: string;
      supplierOrderNo?: string;
      notes?: string;
    };
  }) {
    const { tenantId, orderId, actor, data } = params;

    let order = await this.ordersRepo.findById(tenantId, orderId);
    if (!order) {
      order = await this.ordersRepo.findByOrderNumber(tenantId, orderId);
    }
    if (!order) {
      throw new AppError(ErrorCode.NOT_FOUND, "Order not found", 404);
    }

    if (["cancelled", "completed", "delivered"].includes(order.status)) {
      throw new AppError(
        ErrorCode.VALIDATION_FAILED,
        `Cannot create purchase decision for order with status '${order.status}'`,
        400
      );
    }

    let material: any = null;
    if (Types.ObjectId.isValid(data.materialId)) {
      material = await this.materialRepo.findById(tenantId, data.materialId);
    }
    if (!material) {
      material = await this.materialRepo.findOne(tenantId, {
        $or: [{ materialName: data.materialId }, { type: data.materialId }],
      });
    }
    if (!material) {
      throw new AppError(ErrorCode.NOT_FOUND, `Material '${data.materialId}' not found`, 404);
    }
    if (material.status === "inactive") {
      throw new AppError(ErrorCode.VALIDATION_FAILED, "Cannot create purchase decision for inactive material", 400);
    }

    let supplier: any = undefined;
    if (data.supplierId) {
      if (Types.ObjectId.isValid(data.supplierId)) {
        supplier = await this.supplierRepo.findById(tenantId, data.supplierId);
      }
      if (!supplier) {
        supplier = await this.supplierRepo.findOne(tenantId, {
          supplierName: data.supplierId,
        });
      }
      if (!supplier) {
        throw new AppError(ErrorCode.NOT_FOUND, `Supplier '${data.supplierId}' not found`, 404);
      }
      if (supplier.status === "inactive") {
        throw new AppError(ErrorCode.VALIDATION_FAILED, "Cannot purchase from inactive supplier", 400);
      }
    }

    if ((order.purchaseDecisions?.length || 0) >= ORDER_CAPS.PURCHASE_DECISIONS) {
      throw new AppError(
        ErrorCode.CAP_EXCEEDED,
        `Purchase decisions cap of ${ORDER_CAPS.PURCHASE_DECISIONS} exceeded`,
        400
      );
    }

    const decisionId = data.decisionId || `pd_${randomUUID().slice(0, 12)}`;
    if (order.purchaseDecisions?.some((d: any) => d.decisionId === decisionId)) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, `Purchase decision ID '${decisionId}' already exists on order`, 400);
    }

    const orderNo = data.supplierOrderNo || `PO-${Date.now().toString(36).toUpperCase()}`;
    const ratePaise = data.ratePaise ?? (material.currentRatePaise || 10000);

    const decisionDoc = {
      decisionId,
      optionId: data.optionId,
      materialId: String(material._id),
      supplierId: supplier ? String(supplier._id) : undefined,
      qty: data.qty,
      ratePaise,
      expectedArrivalDate: data.expectedArrivalDate,
      decidedBy: actor.id,
      decidedAt: new Date(),
      supplierOrder: {
        orderNo,
        status: "ordered" as const,
        recvQty: 0,
      },
    };

    const resolvedOrderId = String(order._id);
    const updatedOrder = await this.ordersRepo.addPurchaseDecision(tenantId, resolvedOrderId, decisionDoc);

    await this.auditService.log({
      tenantId,
      actor: { id: actor.id, type: "user", email: actor.email },
      action: "PURCHASE_DECISION_CREATED",
      entity: { collection: "orders", id: resolvedOrderId },
      after: { decisionId, materialId: String(material._id), supplierId: supplier ? String(supplier._id) : undefined, qty: data.qty, ratePaise },
      ip: actor.ip,
      requestId: actor.requestId,
    });

    const createdDecision = updatedOrder.purchaseDecisions?.find((d: any) => d.decisionId === decisionId);

    return {
      orderId: resolvedOrderId,
      orderNumber: updatedOrder.orderNumber,
      decision: createdDecision || decisionDoc,
    };
  }

  async updatePurchaseDecision(params: {
    tenantId: string;
    orderId?: string;
    decisionId: string;
    actor: { id: string; email?: string; ip?: string; requestId?: string };
    data: {
      expectedArrivalDate?: string;
      status?: "ordered" | "cancelled" | "approved" | "rejected";
      action?: "approve" | "reject";
      reason?: string;
      notes?: string;
    };
  }) {
    const { tenantId, orderId, decisionId, actor, data } = params;

    let order: any = null;
    if (orderId) {
      order = await this.ordersRepo.findById(tenantId, orderId);
      if (!order) {
        order = await this.ordersRepo.findByOrderNumber(tenantId, orderId);
      }
    } else {
      order = await this.ordersRepo.findByPurchaseDecisionId(tenantId, decisionId);
    }

    if (!order) {
      throw new AppError(ErrorCode.NOT_FOUND, "Order or purchase decision not found", 404);
    }

    const existingDecision = order.purchaseDecisions?.find(
      (d: any) => d.decisionId === decisionId || d.supplierOrder?.orderNo === decisionId
    );
    if (!existingDecision) {
      throw new AppError(ErrorCode.NOT_FOUND, `Purchase decision '${decisionId}' not found on order`, 404);
    }

    let targetStatus: "ordered" | "cancelled" | undefined = undefined;
    if (data.action === "approve" || data.status === "ordered" || data.status === "approved") {
      targetStatus = "ordered";
    } else if (data.action === "reject" || data.status === "cancelled" || data.status === "rejected") {
      targetStatus = "cancelled";
    }

    if (existingDecision.supplierOrder?.status === "cancelled" && targetStatus === "cancelled") {
      throw new AppError(
        ErrorCode.VALIDATION_FAILED,
        "Purchase decision is already cancelled/rejected",
        400
      );
    }

    if (targetStatus === "cancelled" && (existingDecision.supplierOrder?.recvQty ?? 0) > 0) {
      throw new AppError(
        ErrorCode.VALIDATION_FAILED,
        "Cannot cancel a purchase decision where items have already been received",
        400
      );
    }

    const resolvedOrderId = String(order._id);
    const resolvedDecisionId = existingDecision.decisionId;

    const updatedOrder = await this.ordersRepo.updatePurchaseDecision(tenantId, resolvedOrderId, resolvedDecisionId, {
      expectedArrivalDate: data.expectedArrivalDate,
      status: targetStatus,
      notes: data.reason || data.notes,
    });
    if (!updatedOrder) {
      throw new AppError(ErrorCode.NOT_FOUND, "Order or purchase decision not found", 404);
    }

    const actionName = targetStatus === "ordered" ? "PURCHASE_DECISION_APPROVED" : "PURCHASE_DECISION_REJECTED";

    await this.auditService.log({
      tenantId,
      actor: { id: actor.id, type: "user", email: actor.email },
      action: actionName,
      entity: { collection: "orders", id: resolvedOrderId },
      before: {
        status: existingDecision.supplierOrder?.status,
        expectedArrivalDate: existingDecision.expectedArrivalDate,
      },
      after: {
        status: targetStatus,
        expectedArrivalDate: data.expectedArrivalDate || existingDecision.expectedArrivalDate,
        notes: data.reason || data.notes,
      },
      ip: actor.ip,
      requestId: actor.requestId,
    });

    const updatedDecision = updatedOrder.purchaseDecisions?.find((d: any) => d.decisionId === resolvedDecisionId);

    return {
      orderId: resolvedOrderId,
      orderNumber: updatedOrder.orderNumber,
      decision: updatedDecision || existingDecision,
    };
  }

  async listPurchaseDecisions(
    tenantId: string,
    filter: {
      status?: string;
      materialId?: string;
      supplierId?: string;
      orderId?: string;
      search?: string;
    },
    pagination: PaginationQuery
  ) {
    return this.ordersRepo.findPurchaseDecisionsPaginated(tenantId, filter, pagination);
  }

  async checkMaterialReadiness(tenantId: string, orderId: string) {
    const order = await this.ordersRepo.findById(tenantId, orderId);
    if (!order) {
      throw new AppError(ErrorCode.NOT_FOUND, "Order not found", 404);
    }

    const requirements = order.feasibility?.materialRequirements || [];
    const reservations = order.reservations || [];
    const purchaseDecisions = order.purchaseDecisions || [];

    const materialsReadiness = [];
    let allReady = true;

    for (const req of requirements) {
      const materialIdStr = String(req.materialId);
      const material = await this.materialRepo.findById(tenantId, materialIdStr);

      const requiredQty = req.req || 0;
      const stockQty = material?.stockQty ?? 0;
      const totalReservedQty = material?.reservedQty ?? 0;
      const availableUnreservedQty = Math.max(0, stockQty - totalReservedQty);

      // Active reservations specifically on this order
      const activeOrderReservations = reservations.filter(
        (r: any) => String(r.materialId) === materialIdStr && r.status === "active"
      );
      const reservedOnOrder = activeOrderReservations.reduce((acc: number, r: any) => acc + (r.qty || 0), 0);

      // Open purchase decisions specifically on this order
      const openDecisions = purchaseDecisions.filter(
        (pd: any) =>
          String(pd.materialId) === materialIdStr &&
          ["ordered", "partially_received"].includes(pd.supplierOrder?.status || "")
      );
      const onOrderQty = openDecisions.reduce(
        (acc: number, pd: any) => acc + Math.max(0, (pd.qty || 0) - (pd.supplierOrder?.recvQty || 0)),
        0
      );

      const shortageQty = Math.max(0, requiredQty - reservedOnOrder - availableUnreservedQty - onOrderQty);

      let status: "reserved" | "in_stock" | "on_order" | "shortage";
      if (reservedOnOrder >= requiredQty) {
        status = "reserved";
      } else if (reservedOnOrder + availableUnreservedQty >= requiredQty) {
        status = "in_stock";
      } else if (reservedOnOrder + availableUnreservedQty + onOrderQty >= requiredQty) {
        status = "on_order";
      } else {
        status = "shortage";
      }

      if (status === "shortage") {
        allReady = false;
      }

      materialsReadiness.push({
        materialId: materialIdStr,
        materialName: material?.materialName ?? "Unknown Material",
        type: material?.type ?? "yarn",
        unit: material?.unit,
        requiredQty,
        reservedOnOrder,
        availableUnreservedQty,
        onOrderQty,
        shortageQty,
        status,
      });
    }

    return {
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      orderStatus: order.status,
      isReady: allReady,
      materials: materialsReadiness,
    };
  }
}
