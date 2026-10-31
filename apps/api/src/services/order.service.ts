import { OrdersRepository } from "../repositories/orders.repository.js";
import { AdminCostingService } from "./admin/admin-costing.service.js";
import { CounterRepository } from "../repositories/counter.repository.js";
import { ClientRepository } from "../repositories/client.repository.js";
import { ProductRepository } from "../repositories/product.repository.js";
import { SettingsRepository } from "../repositories/settings.repository.js";
import { NotificationRepository } from "../repositories/notification.repository.js";
import { OutboxRepository } from "../repositories/outbox.repository.js";
import { FileService } from "./file.service.js";
import { QuotationPdfService } from "./quotation-pdf.service.js";
import { AuditService } from "./audit.service.js";
import { IAgentsClient } from "../interfaces/agents-client.interface.js";
import { getContainer } from "../container.js";
import { AppError } from "../errors/app-error.js";
import {
  ErrorCode,
  OrderStatus,
  toClientOrderStatus,
  splitPaise,
  InternalFeasibilityReport,
  InternalQuotationDraft,
  InternalQuotationRevision,
} from "@loompilot/shared";
import { PaginationQuery, PaginatedResult } from "../utils/pagination.js";
import { getTodayBusinessDate } from "../utils/dates.js";

export function toClientOrderDto(order: any): any {
  const isQuotationVisible =
    [
      "quotation_sent",
      "client_accepted",
      "assigned",
      "in_production",
      "ready_for_delivery",
      "partially_delivered",
      "delivered",
      "completed",
    ].includes(order.status) && Boolean(order.quotation);

  return {
    id: String(order._id),
    orderNumber: order.orderNumber,
    productId: order.productId ? String(order.productId) : undefined,
    productDescription: order.productDescription,
    quantity: order.quantity,
    deliveryDeadline: order.deliveryDeadline,
    deliveryAddress: order.deliveryAddress,
    spec: order.spec,
    notes: order.notes,
    referenceFiles: order.referenceFiles?.map(String) || [],
    status: toClientOrderStatus(order.status),
    quotation: isQuotationVisible
      ? {
          unitPricePaise: order.quotation.unitPricePaise,
          totalPaise: order.quotation.totalPaise,
          etaDate: order.quotation.etaDate,
          lineItems: order.quotation.lineItems,
          paymentSchedule: order.quotation.paymentSchedule,
          processPlan: order.quotation.processPlan,
          clientExplanation: order.quotation.clientExplanation,
          clientPdfFileId: order.quotation.clientPdfFileId
            ? String(order.quotation.clientPdfFileId)
            : undefined,
        }
      : undefined,
    production: order.production
      ? {
          phase: order.production.phase,
          percentComplete: order.production.percentComplete,
          producedQty: order.production.producedQty,
        }
      : undefined,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export function toAdminOrderDto(order: any): any {
  const { costing, ...safeOrder } = order;
  return safeOrder;
}

export class OrderService {
  constructor(
    private readonly ordersRepo = new OrdersRepository(),
    private readonly adminCostingService = new AdminCostingService(),
    private readonly counterRepo = new CounterRepository(),
    private readonly clientRepo = new ClientRepository(),
    private readonly productRepo = new ProductRepository(),
    private readonly settingsRepo = new SettingsRepository(),
    private readonly notificationRepo = new NotificationRepository(),
    private readonly outboxRepo = new OutboxRepository(),
    private readonly fileService = new FileService(),
    private readonly pdfService = new QuotationPdfService(),
    private readonly auditService = new AuditService(),
    private agentsClient?: IAgentsClient
  ) {}

  private getAgentsClient(): IAgentsClient {
    if (!this.agentsClient) {
      this.agentsClient = getContainer().agentsClient;
    }
    return this.agentsClient;
  }

  async submitOrder(params: {
    tenantId: string;
    clientId: string;
    productId?: string;
    productDescription?: string;
    quantity: number;
    deliveryDeadline: string;
    deliveryAddress?: string;
    spec: {
      sizes?: string[];
      gsm?: number;
      colours?: string[];
      fabric?: string;
      print?: string;
    };
    notes?: string;
    referenceFiles?: string[];
    actor: { id: string; email?: string; ip?: string; requestId?: string; type: "user" | "client" };
  }): Promise<any> {
    const { tenantId, clientId, actor } = params;

    if (!params.quantity || params.quantity <= 0) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, "Quantity must be a positive integer", 400);
    }

    if (!params.productId && !params.productDescription) {
      throw new AppError(
        ErrorCode.VALIDATION_FAILED,
        "Either a valid catalog productId or a custom productDescription must be provided",
        400
      );
    }

    let productDesc = params.productDescription;
    if (params.productId) {
      const product = await this.productRepo.findById(tenantId, params.productId);
      if (!product || product.active === false) {
        throw new AppError(ErrorCode.VALIDATION_FAILED, "Selected catalog product is invalid or inactive", 400);
      }
      if (!productDesc) {
        productDesc = product.productName;
      }
    }

    const today = getTodayBusinessDate();
    if (params.deliveryDeadline <= today) {
      throw new AppError(
        ErrorCode.VALIDATION_FAILED,
        `Delivery deadline '${params.deliveryDeadline}' must be a future date (after ${today})`,
        400
      );
    }

    const seq = await this.counterRepo.getNextSequence(tenantId, "orders");
    const year = new Date().getFullYear();
    const orderNumber = `ORD-${year}-${String(seq).padStart(5, "0")}`;

    const created = await this.ordersRepo.createOrder(tenantId, {
      orderNumber,
      clientId,
      productId: params.productId,
      productDescription: productDesc!,
      quantity: params.quantity,
      deliveryDeadline: params.deliveryDeadline,
      deliveryAddress: params.deliveryAddress,
      spec: {
        sizes: params.spec?.sizes || ["M"],
        gsm: params.spec?.gsm,
        colours: params.spec?.colours || [],
        fabric: params.spec?.fabric,
        print: params.spec?.print,
      },
      notes: params.notes,
      referenceFiles: params.referenceFiles,
      actorId: actor.id,
    });

    // Auto-transition to analyzing
    const analyzingOrder = await this.ordersRepo.updateStatus(
      tenantId,
      created._id as any,
      OrderStatus.ANALYZING,
      { role: "admin", reason: "Automatic transition to feasibility analysis" }
    );

    // Notifications & Outbox
    await this.notificationRepo.createNotification(tenantId, {
      recipient: { clientId },
      kind: "notification",
      type: "order_submitted",
      channel: "in_app",
      title: "Order Submitted",
      body: `Your order ${orderNumber} has been received and is undergoing automated feasibility analysis.`,
      entity: { collection: "orders", id: String(created._id) },
    });

    await this.outboxRepo.createMessage(tenantId, {
      recipient: { clientId },
      channel: "email",
      payload: {
        subject: `Order Confirmation: ${orderNumber}`,
        orderNumber,
        productDescription: productDesc,
        quantity: params.quantity,
        deliveryDeadline: params.deliveryDeadline,
      },
    });

    // Audit
    await this.auditService.log({
      tenantId,
      actor: { id: actor.id, type: actor.type, email: actor.email },
      action: "ORDER_SUBMITTED",
      entity: { collection: "orders", id: String(created._id) },
      after: { orderNumber, status: OrderStatus.ANALYZING },
      ip: actor.ip,
      requestId: actor.requestId,
    });

    // Asynchronous/Synchronous Feasibility Request
    try {
      const client = this.getAgentsClient();
      const result = await client.requestFeasibility({
        tenantId,
        orderId: String(created._id),
        productId: params.productId,
        productDescription: productDesc,
        quantity: params.quantity,
        deadline: params.deliveryDeadline,
        spec: params.spec,
      });

      if (result.success && result.data) {
        await this.ingestFeasibilityReport(result.data, {
          id: "agent_gateway",
          type: "agent",
          requestId: actor.requestId,
        });
      }
    } catch {
      // In background or http mode, agents will call /internal/v1/feasibility-reports asynchronously
    }

    return actor.type === "client" ? toClientOrderDto(analyzingOrder) : toAdminOrderDto(analyzingOrder);
  }

  async listOrders(params: {
    tenantId: string;
    pagination: PaginationQuery;
    filter?: {
      status?: string;
      clientId?: string;
      search?: string;
    };
    isClient?: boolean;
    clientId?: string;
  }): Promise<PaginatedResult<any>> {
    const { tenantId, pagination, isClient, clientId, filter = {} } = params;

    const queryFilter: Record<string, any> = {};
    if (isClient) {
      queryFilter.clientId = clientId;
    } else {
      if (filter.clientId) {
        queryFilter.clientId = filter.clientId;
      }
    }

    if (filter.status) {
      queryFilter.status = filter.status;
    }

    if (filter.search) {
      queryFilter.orderNumber = { $regex: filter.search.trim(), $options: "i" };
    }

    const result = await this.ordersRepo.findPaginated(tenantId, queryFilter, pagination);

    const mapped = result.data.map((order) =>
      isClient ? toClientOrderDto(order) : toAdminOrderDto(order)
    );

    return {
      data: mapped,
      meta: result.meta,
    };
  }

  async getOrderById(params: {
    tenantId: string;
    orderId: string;
    isClient?: boolean;
    clientId?: string;
  }): Promise<any> {
    const { tenantId, orderId, isClient, clientId } = params;
    const order = await this.ordersRepo.findById(tenantId, orderId);

    if (!order) {
      throw new AppError(ErrorCode.NOT_FOUND, `Order '${orderId}' not found`, 404);
    }

    if (isClient) {
      if (String(order.clientId) !== String(clientId)) {
        throw new AppError(ErrorCode.FORBIDDEN, "Access denied: Order does not belong to client", 403);
      }
      return toClientOrderDto(order);
    }

    return toAdminOrderDto(order);
  }

  async ingestFeasibilityReport(
    report: InternalFeasibilityReport,
    actor: { id: string; type: "agent" | "user"; requestId?: string }
  ): Promise<any> {
    const { tenantId, orderId, verdict } = report;
    const order = await this.ordersRepo.findById(tenantId, orderId);
    if (!order) {
      throw new AppError(ErrorCode.NOT_FOUND, `Order '${orderId}' not found for feasibility report`, 404);
    }

    await this.ordersRepo.setFeasibility(tenantId, orderId, report);

    let nextStatus: OrderStatus;
    if (verdict === "feasible") {
      nextStatus = OrderStatus.QUOTATION_DRAFTING;
    } else if (verdict === "at_risk") {
      nextStatus = OrderStatus.AWAITING_ADMIN_DECISION;
    } else {
      nextStatus = OrderStatus.AWAITING_ADMIN_DECISION;
    }

    const updated = await this.ordersRepo.updateStatus(tenantId, orderId, nextStatus, {
      role: "admin",
      reason: `Feasibility result: ${verdict}. ${report.reasonsSummary || ""}`,
    });

    await this.auditService.log({
      tenantId,
      actor: { id: actor.id, type: actor.type },
      action: "FEASIBILITY_REPORT_INGESTED",
      entity: { collection: "orders", id: orderId },
      after: { verdict, nextStatus, etaDate: report.etaDate },
      requestId: actor.requestId,
    });

    // If feasible, automatically trigger quotation draft request
    if (verdict === "feasible") {
      try {
        const client = this.getAgentsClient();
        const draftResult = await client.requestQuotationDraft({
          tenantId,
          orderId,
          quantity: order.quantity,
          deadline: report.etaDate,
        });

        if (draftResult.success && draftResult.data) {
          await this.ingestQuotationDraft(draftResult.data, actor);
        }
      } catch {
        // Will be delivered asynchronously via /internal/v1/quotation-drafts
      }
    }

    return updated;
  }

  async ingestQuotationDraft(
    draft: InternalQuotationDraft,
    actor: { id: string; type: "agent" | "user"; requestId?: string }
  ): Promise<any> {
    const { tenantId, orderId } = draft;
    const order = await this.ordersRepo.findById(tenantId, orderId);
    if (!order) {
      throw new AppError(ErrorCode.NOT_FOUND, `Order '${orderId}' not found for quotation draft`, 404);
    }

    const quotationData: any = {
      version: (order.quotation?.version || 0) + 1,
      unitPricePaise: draft.unitPricePaise,
      totalPaise: draft.totalPaise,
      etaDate: draft.etaDate,
      lineItems: draft.lineItems,
      paymentSchedule: draft.paymentSchedule,
      processPlan: draft.processPlan,
      etaBasis: draft.etaBasis,
      explanation: draft.explanation,
      clientExplanation: draft.clientExplanation,
      termsVersion: draft.termsVersion,
      priceVariationClause: draft.priceVariationClause,
      lockedMaterials: draft.lockedMaterials,
      marginWarning: draft.marginWarning,
      basePriceWarning: draft.basePriceWarning,
      lowData: draft.lowData,
      generatedAt: new Date(),
    };

    await this.ordersRepo.setQuotation(tenantId, orderId, quotationData);

    if (draft.costing) {
      await this.adminCostingService.updateCosting(tenantId, orderId, draft.costing);
    }

    const updated = await this.ordersRepo.updateStatus(
      tenantId,
      orderId,
      OrderStatus.QUOTATION_PENDING_APPROVAL,
      { role: "admin", reason: "Automated quotation drafted and pending admin approval" }
    );

    await this.auditService.log({
      tenantId,
      actor: { id: actor.id, type: actor.type },
      action: "QUOTATION_DRAFT_INGESTED",
      entity: { collection: "orders", id: orderId },
      after: { totalPaise: draft.totalPaise, etaDate: draft.etaDate },
      requestId: actor.requestId,
    });

    return updated;
  }

  async decideOrder(params: {
    tenantId: string;
    orderId: string;
    decision: "proceed" | "reject" | "alternative";
    alternativeId?: string;
    purchaseDecision?: any;
    notes?: string;
    actor: { id: string; email?: string; ip?: string; requestId?: string };
  }): Promise<any> {
    const { tenantId, orderId, decision, alternativeId, purchaseDecision, notes, actor } = params;
    const order = await this.ordersRepo.findById(tenantId, orderId);
    if (!order) {
      throw new AppError(ErrorCode.NOT_FOUND, `Order '${orderId}' not found`, 404);
    }

    let updated: any;
    if (decision === "proceed") {
      updated = await this.ordersRepo.updateStatus(tenantId, orderId, OrderStatus.QUOTATION_DRAFTING, {
        role: "admin",
        reason: notes || "Admin decided to proceed with order",
      });

      // Trigger quotation draft
      try {
        const client = this.getAgentsClient();
        const draftResult = await client.requestQuotationDraft({
          tenantId,
          orderId,
          quantity: order.quantity,
          deadline: order.feasibility?.etaDate,
        });
        if (draftResult.success && draftResult.data) {
          await this.ingestQuotationDraft(draftResult.data, { id: actor.id, type: "user" });
        }
      } catch {}
    } else if (decision === "reject") {
      updated = await this.ordersRepo.updateStatus(tenantId, orderId, OrderStatus.REJECTED_BY_ADMIN, {
        role: "admin",
        reason: notes || "Rejected by administrator decision",
      });
    } else if (decision === "alternative") {
      if (purchaseDecision) {
        await this.ordersRepo.addPurchaseDecision(tenantId, orderId, {
          ...purchaseDecision,
          recordedAt: new Date(),
          recordedBy: actor.id,
        });
      }
      updated = await this.ordersRepo.updateStatus(tenantId, orderId, OrderStatus.QUOTATION_DRAFTING, {
        role: "admin",
        reason: notes || `Admin selected alternative: ${alternativeId || "alternative option"}`,
      });

      try {
        const client = this.getAgentsClient();
        const draftResult = await client.requestQuotationDraft({
          tenantId,
          orderId,
          quantity: order.quantity,
          deadline: order.feasibility?.etaDate,
        });
        if (draftResult.success && draftResult.data) {
          await this.ingestQuotationDraft(draftResult.data, { id: actor.id, type: "user" });
        }
      } catch {}
    }

    await this.auditService.log({
      tenantId,
      actor: { id: actor.id, type: "user", email: actor.email },
      action: "ORDER_DECISION_RECORDED",
      entity: { collection: "orders", id: orderId },
      after: { decision, notes },
      ip: actor.ip,
      requestId: actor.requestId,
    });

    return toAdminOrderDto(updated);
  }

  async approveQuotation(params: {
    tenantId: string;
    orderId: string;
    notes?: string;
    actor: { id: string; email?: string; ip?: string; requestId?: string };
  }): Promise<any> {
    const { tenantId, orderId, notes, actor } = params;
    const order = await this.ordersRepo.findById(tenantId, orderId);
    if (!order) {
      throw new AppError(ErrorCode.NOT_FOUND, `Order '${orderId}' not found`, 404);
    }

    if (order.status !== OrderStatus.QUOTATION_PENDING_APPROVAL) {
      throw new AppError(
        ErrorCode.VALIDATION_FAILED,
        `Cannot approve quotation for order with status '${order.status}'`,
        400
      );
    }

    await this.auditService.log({
      tenantId,
      actor: { id: actor.id, type: "user", email: actor.email },
      action: "QUOTATION_APPROVED",
      entity: { collection: "orders", id: orderId },
      after: { approved: true, notes },
      ip: actor.ip,
      requestId: actor.requestId,
    });

    return toAdminOrderDto(order);
  }

  async sendQuotation(params: {
    tenantId: string;
    orderId: string;
    idempotencyKey?: string;
    actor: { id: string; email?: string; ip?: string; requestId?: string };
  }): Promise<any> {
    const { tenantId, orderId, actor } = params;
    const order = await this.ordersRepo.findById(tenantId, orderId);
    if (!order) {
      throw new AppError(ErrorCode.NOT_FOUND, `Order '${orderId}' not found`, 404);
    }

    if (order.status === OrderStatus.QUOTATION_SENT) {
      return toAdminOrderDto(order); // Idempotent return
    }

    if (order.status !== OrderStatus.QUOTATION_PENDING_APPROVAL) {
      throw new AppError(
        ErrorCode.VALIDATION_FAILED,
        `Order must be in quotation_pending_approval to send quotation (current: ${order.status})`,
        400
      );
    }

    const client = await this.clientRepo.findById(tenantId, String(order.clientId));
    if (!client) {
      throw new AppError(ErrorCode.NOT_FOUND, "Client for order not found", 404);
    }

    if (!order.quotation) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, "Order does not have a quotation drafted", 400);
    }

    // Generate Quotation PDF
    const pdfBuffer = await this.pdfService.generateQuotationPdf({
      orderNumber: order.orderNumber,
      clientName: client.clientName,
      clientEmail: client.email,
      productDescription: order.productDescription || "Custom Manufacturing Item",
      quantity: order.quantity,
      unitPricePaise: order.quotation.unitPricePaise!,
      totalPaise: order.quotation.totalPaise!,
      etaDate: order.quotation.etaDate || "TBD",
      paymentSchedule: (order.quotation.paymentSchedule || []).map((m: any) => ({
        milestone: m.milestone,
        percent: m.percent,
        amountPaise: m.amountPaise,
        trigger: m.trigger,
        stage: m.stage,
      })),
      processPlan: order.quotation.processPlan,
      clientExplanation: order.quotation.clientExplanation,
      priceVariationClause: order.quotation.priceVariationClause,
      termsVersion: order.quotation.termsVersion,
    });

    // Store PDF file with ownership metadata for client
    const fileDoc = await this.fileService.uploadFile({
      tenantId,
      file: {
        buffer: pdfBuffer,
        originalname: `Quotation_${order.orderNumber}.pdf`,
        mimetype: "application/pdf",
        size: pdfBuffer.length,
      },
      ownerRealm: "client",
      ownerId: String(order.clientId),
      actor,
    });

    await this.ordersRepo.setQuotationClientPdfFileId(tenantId, orderId, String(fileDoc._id));

    // Transition status to quotation_sent
    const updated = await this.ordersRepo.updateStatus(tenantId, orderId, OrderStatus.QUOTATION_SENT, {
      role: "admin",
      reason: "Quotation generated, approved, and dispatched to client",
    });

    // Notify client
    await this.notificationRepo.createNotification(tenantId, {
      recipient: { clientId: String(order.clientId) },
      kind: "notification",
      type: "quotation_ready",
      channel: "in_app",
      title: `Quotation Ready for ${order.orderNumber}`,
      body: `Your quotation for ${order.orderNumber} is ready for review. Total: ₹${((order.quotation?.totalPaise || 0) / 100).toLocaleString()}`,
      entity: { collection: "orders", id: orderId },
    });

    await this.outboxRepo.createMessage(tenantId, {
      recipient: { clientId: String(order.clientId) },
      channel: "email",
      payload: {
        subject: `Quotation for Order ${order.orderNumber}`,
        orderNumber: order.orderNumber,
        totalPaise: order.quotation.totalPaise,
        etaDate: order.quotation.etaDate,
        pdfFileId: String(fileDoc._id),
      },
    });

    await this.auditService.log({
      tenantId,
      actor: { id: actor.id, type: "user", email: actor.email },
      action: "QUOTATION_SENT",
      entity: { collection: "orders", id: orderId },
      after: { status: OrderStatus.QUOTATION_SENT, fileId: String(fileDoc._id) },
      ip: actor.ip,
      requestId: actor.requestId,
    });

    return toAdminOrderDto(updated);
  }

  async clientAcceptQuotation(params: {
    tenantId: string;
    clientId: string;
    orderId: string;
    idempotencyKey?: string;
    actor: { id: string; email?: string; ip?: string; requestId?: string };
  }): Promise<any> {
    const { tenantId, clientId, orderId, actor } = params;
    const order = await this.ordersRepo.findById(tenantId, orderId);
    if (!order) {
      throw new AppError(ErrorCode.NOT_FOUND, `Order '${orderId}' not found`, 404);
    }

    if (String(order.clientId) !== String(clientId)) {
      throw new AppError(ErrorCode.FORBIDDEN, "Access denied: Order does not belong to client", 403);
    }

    if (order.status === OrderStatus.CLIENT_ACCEPTED) {
      return toClientOrderDto(order); // Idempotent return
    }

    if (order.status !== OrderStatus.QUOTATION_SENT) {
      throw new AppError(
        ErrorCode.VALIDATION_FAILED,
        `Cannot accept quotation for order in '${order.status}' status`,
        400
      );
    }

    const updated = await this.ordersRepo.updateStatus(tenantId, orderId, OrderStatus.CLIENT_ACCEPTED, {
      role: "admin",
      reason: "Quotation accepted by client",
    });

    await this.notificationRepo.createNotification(tenantId, {
      recipient: {},
      kind: "notification",
      type: "quotation_accepted",
      channel: "in_app",
      title: `Order ${order.orderNumber} Confirmed`,
      body: `Client has accepted quotation for order ${order.orderNumber}. Handover to production is pending.`,
      entity: { collection: "orders", id: orderId },
    });

    await this.auditService.log({
      tenantId,
      actor: { id: actor.id, type: "client", email: actor.email },
      action: "QUOTATION_ACCEPTED",
      entity: { collection: "orders", id: orderId },
      after: { status: OrderStatus.CLIENT_ACCEPTED },
      ip: actor.ip,
      requestId: actor.requestId,
    });

    return toClientOrderDto(updated);
  }

  async clientDeclineQuotation(params: {
    tenantId: string;
    clientId: string;
    orderId: string;
    reason?: string;
    idempotencyKey?: string;
    actor: { id: string; email?: string; ip?: string; requestId?: string };
  }): Promise<any> {
    const { tenantId, clientId, orderId, reason, actor } = params;
    const order = await this.ordersRepo.findById(tenantId, orderId);
    if (!order) {
      throw new AppError(ErrorCode.NOT_FOUND, `Order '${orderId}' not found`, 404);
    }

    if (String(order.clientId) !== String(clientId)) {
      throw new AppError(ErrorCode.FORBIDDEN, "Access denied: Order does not belong to client", 403);
    }

    if (order.status === OrderStatus.DECLINED_BY_CLIENT) {
      return toClientOrderDto(order); // Idempotent return
    }

    if (order.status !== OrderStatus.QUOTATION_SENT) {
      throw new AppError(
        ErrorCode.VALIDATION_FAILED,
        `Cannot decline quotation for order in '${order.status}' status`,
        400
      );
    }

    const updated = await this.ordersRepo.updateStatus(
      tenantId,
      orderId,
      OrderStatus.DECLINED_BY_CLIENT,
      {
        role: "admin",
        reason: reason || "Declined by client",
      }
    );

    await this.notificationRepo.createNotification(tenantId, {
      recipient: {},
      kind: "notification",
      type: "quotation_declined",
      channel: "in_app",
      title: `Order ${order.orderNumber} Declined`,
      body: `Client declined quotation for ${order.orderNumber}. Reason: ${reason || "None"}`,
      entity: { collection: "orders", id: orderId },
    });

    await this.auditService.log({
      tenantId,
      actor: { id: actor.id, type: "client", email: actor.email },
      action: "QUOTATION_DECLINED",
      entity: { collection: "orders", id: orderId },
      after: { status: OrderStatus.DECLINED_BY_CLIENT, reason },
      ip: actor.ip,
      requestId: actor.requestId,
    });

    return toClientOrderDto(updated);
  }

  async ingestQuotationRevision(
    revision: InternalQuotationRevision,
    actor: { id: string; type: "agent" | "user"; requestId?: string }
  ): Promise<any> {
    const { tenantId, orderId, newPricePaise } = revision;
    const order = await this.ordersRepo.findById(tenantId, orderId);
    if (!order) {
      throw new AppError(ErrorCode.NOT_FOUND, `Order '${orderId}' not found for revision`, 404);
    }

    // S4 Invariant Guard: Cannot revise materials or pricing once past knitting or cutting
    const restrictedPhases = ["knitting", "dyeing_processing", "cutting", "stitching", "checking", "ironing_finishing", "packing"];
    if (
      order.status === OrderStatus.IN_PRODUCTION &&
      restrictedPhases.includes(order.production?.phase || "")
    ) {
      throw new AppError(
        ErrorCode.VALIDATION_FAILED,
        `Cannot revise quotation once manufacturing has entered production phase '${order.production?.phase}'`,
        400
      );
    }

    // Recompute milestone payment amounts using splitPaise
    const currentSchedule = order.quotation?.paymentSchedule || [];
    if (currentSchedule.length > 0) {
      const weights = currentSchedule.map((m: any) => m.percent);
      const newAmounts = splitPaise(newPricePaise, weights);
      for (let i = 0; i < currentSchedule.length; i++) {
        if (currentSchedule[i] && newAmounts[i] !== undefined) {
          currentSchedule[i]!.amountPaise = newAmounts[i]!;
        }
      }
    }

    await this.ordersRepo.addQuotationRevision(tenantId, orderId, {
      ...revision,
      createdAt: new Date(),
    });

    const updatedQuotation = {
      ...order.quotation,
      totalPaise: newPricePaise,
      unitPricePaise: Math.round(newPricePaise / order.quantity),
      etaDate: revision.newEtaDate || order.quotation?.etaDate,
      paymentSchedule: currentSchedule,
      version: (order.quotation?.version || 1) + 1,
    };

    const updated = await this.ordersRepo.setQuotation(tenantId, orderId, updatedQuotation);

    await this.auditService.log({
      tenantId,
      actor: { id: actor.id, type: actor.type },
      action: "QUOTATION_REVISION_INGESTED",
      entity: { collection: "orders", id: orderId },
      after: { newPricePaise, changePct: revision.changePct, reasonType: revision.reasonType },
      requestId: actor.requestId,
    });

    return updated;
  }

  async runQuoteReminders(tenantId: string): Promise<number> {
    const settings = await this.settingsRepo.getSettings(tenantId);
    const reminderDays = new Set(settings?.quoteReminderDays || [1]);

    const activeQuotes = await this.ordersRepo.findPaginated(
      tenantId,
      { status: OrderStatus.QUOTATION_SENT },
      { page: 1, limit: 100, sortOrder: "desc" }
    );

    let remindersSent = 0;
    const now = Date.now();

    for (const order of activeQuotes.data) {
      const sentHistory = order.statusHistory?.slice().reverse().find((h: any) => h.status === OrderStatus.QUOTATION_SENT);
      const fallbackDate = order.updatedAt || order.createdAt || new Date();
      const sentAt = sentHistory?.at ? new Date(sentHistory.at).getTime() : new Date(fallbackDate).getTime();
      const elapsedDays = Math.floor((now - sentAt) / (24 * 60 * 60 * 1000));

      if (reminderDays.has(elapsedDays)) {
        await this.notificationRepo.createNotification(tenantId, {
          recipient: { clientId: String(order.clientId) },
          kind: "notification",
          type: "quotation_reminder",
          channel: "in_app",
          title: `Quotation Reminder for Order ${order.orderNumber}`,
          body: `Reminder: Your quotation for ${order.orderNumber} is awaiting your review and approval.`,
          entity: { collection: "orders", id: String(order._id) },
          dedupeKey: `quote_reminder_${order._id}_day_${elapsedDays}`,
        });

        await this.outboxRepo.createMessage(tenantId, {
          recipient: { clientId: String(order.clientId) },
          channel: "email",
          payload: {
            subject: `Reminder: Quotation for ${order.orderNumber}`,
            orderNumber: order.orderNumber,
            totalPaise: order.quotation?.totalPaise,
            elapsedDays,
          },
        });

        remindersSent++;
      }
    }

    return remindersSent;
  }
}
