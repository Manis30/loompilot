import { OrdersRepository } from "../repositories/orders.repository.js";
import { AdminCostingService } from "./admin/admin-costing.service.js";
import { CounterRepository } from "../repositories/counter.repository.js";
import { ClientRepository } from "../repositories/client.repository.js";
import { ProductRepository } from "../repositories/product.repository.js";
import { SettingsRepository } from "../repositories/settings.repository.js";
import { NotificationRepository } from "../repositories/notification.repository.js";
import { OutboxRepository } from "../repositories/outbox.repository.js";
import { UserRepository } from "../repositories/user.repository.js";
import { MaterialRepository } from "../repositories/material.repository.js";
import { StockMovementRepository } from "../repositories/stock-movement.repository.js";
import { FileService } from "./file.service.js";
import { QuotationPdfService } from "./quotation-pdf.service.js";
import { AuditService } from "./audit.service.js";
import { IAgentsClient } from "../interfaces/agents-client.interface.js";
import { IUnitOfWork } from "../interfaces/unit-of-work.interface.js";
import { IPaymentGateway } from "../interfaces/payment-gateway.interface.js";
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
import { logger } from "../utils/logger.js";

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
          validUntil: order.quotation.validUntil,
          termsVersion: order.quotation.termsVersion,
          priceVariationClause: order.quotation.priceVariationClause,
          paymentSchedule: order.quotation.paymentSchedule,
          clientExplanation: order.quotation.clientExplanation,
          clientPdfFileId: order.quotation.clientPdfFileId
            ? String(order.quotation.clientPdfFileId)
            : undefined,
          revisions: (order.quotation.revisions || []).map((r: any) => ({
            revisionNo: r.revisionNo,
            oldPricePaise: r.oldPricePaise,
            newPricePaise: r.newPricePaise,
            changePct: r.changePct,
            newEtaDate: r.newEtaDate,
            clientReason: r.clientReason,
            status: r.status,
          })),
        }
      : undefined,
    financials: order.financials
      ? {
          totalAmountPaise: order.quotation?.totalPaise || 0,
          totalPaidPaise: order.financials.totalPaidPaise || 0,
          amountDuePaise: Math.max(
            0,
            (order.quotation?.totalPaise || 0) - (order.financials.totalPaidPaise || 0)
          ),
          advanceReceivedPaise: order.financials.advanceReceivedPaise || 0,
          milestones: order.financials.milestones?.map((m: any) => ({
            milestone: m.milestone,
            trigger: m.trigger,
            stage: m.stage,
            amountPaise: m.amountPaise,
            dueDate: m.dueDate,
            status: m.status,
            receivedPaise: m.receivedPaise || 0,
            duePaise: Math.max(0, m.amountPaise - (m.receivedPaise || 0)),
          })),
        }
      : undefined,
    production: order.production
      ? {
          phase: order.production.phase,
          percentComplete: order.production.percentComplete,
          producedQty: order.production.producedQty,
          deliveredQty: order.production.deliveredQty,
          estimatedCompletionDate:
            order.production.monitoring?.projectedFinish ||
            order.quotation?.etaDate ||
            order.deliveryDeadline,
        }
      : undefined,
    deliveries: order.deliveries?.map((d: any) => ({
      deliveryDate: d.deliveryDate,
      qty: d.qty,
      invoiceNo: d.invoiceNo,
      invoiceAmountPaise: d.invoiceAmountPaise,
      onTime: d.onTime,
    })),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export function toSupervisorOrderDto(order: any): any {
  return {
    id: String(order._id),
    orderNumber: order.orderNumber,
    productDescription: order.productDescription,
    quantity: order.quantity,
    deliveryDeadline: order.deliveryDeadline,
    spec: order.spec,
    referenceFiles: order.referenceFiles?.map(String) || [],
    status: order.status,
    production: order.production
      ? {
          phase: order.production.phase,
          percentComplete: order.production.percentComplete,
          producedQty: order.production.producedQty,
          deliveredQty: order.production.deliveredQty,
          assignmentStatus: order.production.assignmentStatus,
          processPlan: (order.production.processPlan || []).map((p: any) => ({
            stage: p.stage,
            start: p.start,
            end: p.end,
            dailyTarget: p.dailyTarget,
          })),
          assignedSupervisors: (order.production.assignedSupervisors || []).map((s: any) => ({
            supervisorId: String(s.supervisorId),
            processes: s.processes || [],
            acknowledgedAt: s.acknowledgedAt,
          })),
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
    private readonly userRepo = new UserRepository(),
    private readonly materialRepo = new MaterialRepository(),
    private readonly stockMovementRepo = new StockMovementRepository(),
    private agentsClient?: IAgentsClient,
    private unitOfWork?: IUnitOfWork,
    private paymentGateway?: IPaymentGateway
  ) {}

  private getAgentsClient(): IAgentsClient {
    if (!this.agentsClient) {
      this.agentsClient = getContainer().agentsClient;
    }
    return this.agentsClient;
  }

  private getUnitOfWork(): IUnitOfWork {
    if (!this.unitOfWork) {
      this.unitOfWork = getContainer().unitOfWork;
    }
    return this.unitOfWork;
  }

  private getPaymentGateway(): IPaymentGateway {
    if (!this.paymentGateway) {
      this.paymentGateway = getContainer().paymentGateway;
    }
    return this.paymentGateway;
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
    role?: "admin" | "supervisor";
    supervisorId?: string;
  }): Promise<any> {
    const { tenantId, orderId, isClient, clientId, role, supervisorId } = params;
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

    if (role === "supervisor") {
      const isAssigned = (order.production?.assignedSupervisors || []).some(
        (s: any) => String(s.supervisorId) === String(supervisorId)
      );
      if (!isAssigned) {
        throw new AppError(ErrorCode.FORBIDDEN, "Access denied: Order not assigned to supervisor", 403);
      }
      return toSupervisorOrderDto(order);
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

  private async getAdminRecipient(tenantId: string): Promise<{ userId: any }> {
    const adminUser = await this.userRepo.findOne(tenantId, { role: "admin" });
    if (adminUser) {
      return { userId: adminUser._id };
    }
    return { userId: "000000000000000000000000" };
  }

  async clientAcceptQuotation(params: {
    tenantId: string;
    clientId: string;
    orderId: string;
    revisionNo?: number;
    idempotencyKey?: string;
    actor: { id: string; email?: string; ip?: string; requestId?: string };
  }): Promise<any> {
    const { tenantId, clientId, orderId, revisionNo, actor } = params;
    const order = await this.ordersRepo.findById(tenantId, orderId);
    if (!order) {
      throw new AppError(ErrorCode.NOT_FOUND, `Order '${orderId}' not found`, 404);
    }

    if (String(order.clientId) !== String(clientId)) {
      throw new AppError(ErrorCode.FORBIDDEN, "Access denied: Order does not belong to client", 403);
    }

    if (revisionNo !== undefined) {
      const revision = (order.quotation?.revisions || []).find((r: any) => r.revisionNo === revisionNo);
      if (!revision) {
        throw new AppError(ErrorCode.NOT_FOUND, `Quotation revision #${revisionNo} not found`, 404);
      }

      if (revision.status === "accepted") {
        return toClientOrderDto(order); // Idempotent return
      }

      const schedule = order.quotation?.paymentSchedule || [];
      let updatedSchedule = schedule;
      if (schedule.length > 0) {
        const weights = schedule.map((m: any) => m.percent);
        const newAmounts = splitPaise(revision.newPricePaise, weights);
        updatedSchedule = schedule.map((m: any, idx: number) => ({
          ...m,
          amountPaise: newAmounts[idx] ?? m.amountPaise,
        }));
      }

      const unitPricePaise = Math.round(revision.newPricePaise / order.quantity);
      const updated = await this.ordersRepo.updateRevisionStatus(
        tenantId,
        orderId,
        revisionNo,
        "accepted",
        { decision: "accepted", at: new Date() },
        {
          totalPaise: revision.newPricePaise,
          unitPricePaise,
          etaDate: revision.newEtaDate || order.quotation?.etaDate,
          paymentSchedule: updatedSchedule,
        }
      );

      if (!updated) {
        throw new AppError(
          ErrorCode.INVALID_TRANSITION,
          `Quotation revision #${revisionNo} cannot be accepted from status '${revision.status}'`,
          409
        );
      }

      if (order.status === OrderStatus.QUOTATION_SENT) {
        await this.ordersRepo.updateStatus(tenantId, orderId, OrderStatus.CLIENT_ACCEPTED, {
          role: "admin",
          reason: `Quotation revision #${revisionNo} accepted by client`,
        });
      }

      await this.notificationRepo.createNotification(tenantId, {
        recipient: await this.getAdminRecipient(tenantId),
        kind: "notification",
        type: "quotation_accepted",
        channel: "in_app",
        title: `Revision #${revisionNo} Accepted for ${order.orderNumber}`,
        body: `Client accepted revised pricing for ${order.orderNumber}. New total: ₹${(revision.newPricePaise / 100).toLocaleString()}`,
        entity: { collection: "orders", id: orderId },
      });

      await this.auditService.log({
        tenantId,
        actor: { id: actor.id, type: "client", email: actor.email },
        action: "QUOTATION_REVISION_ACCEPTED",
        entity: { collection: "orders", id: orderId },
        after: { revisionNo, totalPaise: revision.newPricePaise },
        ip: actor.ip,
        requestId: actor.requestId,
      });

      const refreshed = await this.ordersRepo.findById(tenantId, orderId);
      return toClientOrderDto(refreshed);
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
      recipient: await this.getAdminRecipient(tenantId),
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
    revisionNo?: number;
    reason?: string;
    idempotencyKey?: string;
    actor: { id: string; email?: string; ip?: string; requestId?: string };
  }): Promise<any> {
    const { tenantId, clientId, orderId, revisionNo, reason, actor } = params;
    const order = await this.ordersRepo.findById(tenantId, orderId);
    if (!order) {
      throw new AppError(ErrorCode.NOT_FOUND, `Order '${orderId}' not found`, 404);
    }

    if (String(order.clientId) !== String(clientId)) {
      throw new AppError(ErrorCode.FORBIDDEN, "Access denied: Order does not belong to client", 403);
    }

    if (revisionNo !== undefined) {
      const revision = (order.quotation?.revisions || []).find((r: any) => r.revisionNo === revisionNo);
      if (!revision) {
        throw new AppError(ErrorCode.NOT_FOUND, `Quotation revision #${revisionNo} not found`, 404);
      }

      if (revision.status === "declined") {
        return toClientOrderDto(order); // Idempotent return
      }

      // S4 Rule: When revision is declined, original quotation price stands untouched!
      const updated = await this.ordersRepo.updateRevisionStatus(
        tenantId,
        orderId,
        revisionNo,
        "declined",
        { decision: "declined", reason, at: new Date() }
      );

      if (!updated) {
        throw new AppError(
          ErrorCode.INVALID_TRANSITION,
          `Quotation revision #${revisionNo} cannot be declined from status '${revision.status}'`,
          409
        );
      }

      // Send alert notification to admin
      await this.notificationRepo.createNotification(tenantId, {
        recipient: await this.getAdminRecipient(tenantId),
        kind: "alert",
        type: "quotation_revision_declined",
        channel: "in_app",
        title: `Revision #${revisionNo} Declined for ${order.orderNumber}`,
        body: `Client declined quotation revision #${revisionNo} for ${order.orderNumber}. Original quotation price stands. Reason: ${reason || "None specified"}`,
        entity: { collection: "orders", id: orderId },
      });

      await this.auditService.log({
        tenantId,
        actor: { id: actor.id, type: "client", email: actor.email },
        action: "QUOTATION_REVISION_DECLINED",
        entity: { collection: "orders", id: orderId },
        after: { revisionNo, status: "declined", reason },
        ip: actor.ip,
        requestId: actor.requestId,
      });

      const refreshed = await this.ordersRepo.findById(tenantId, orderId);
      return toClientOrderDto(refreshed);
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
      recipient: await this.getAdminRecipient(tenantId),
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

  // ==========================================================================
  // Phase D: Handover, Controls, Payments & Deliveries
  // ==========================================================================

  async assignSupervisors(params: {
    tenantId: string;
    orderId: string;
    assignments: Array<{
      supervisorId: string;
      processes?: string[];
      processArea?: string;
    }>;
    overrideReason?: string;
    notes?: string;
    actor: { id: string; email?: string; ip?: string; requestId?: string; type: "user" };
  }): Promise<any> {
    const order = await this.ordersRepo.findById(params.tenantId, params.orderId);
    if (!order) {
      throw new AppError(ErrorCode.NOT_FOUND, "Order not found", 404);
    }

    if (
      order.status !== OrderStatus.CLIENT_ACCEPTED &&
      order.status !== OrderStatus.ASSIGNED
    ) {
      throw new AppError(
        ErrorCode.INVALID_TRANSITION,
        `Cannot assign supervisors: order status is '${order.status}'; must be 'client_accepted' or 'assigned'`,
        400
      );
    }

    const processPlan = order.quotation?.processPlan;
    if (!processPlan || processPlan.length === 0) {
      throw new AppError(ErrorCode.PLAN_MISSING, "Quotation process plan is missing or empty", 400);
    }

    const settings = await this.settingsRepo.getSettings(params.tenantId);
    const configuredAreas = new Set(settings?.processConfig?.map((p: any) => p.area) || []);

    // Advance Gate validation
    const advanceMilestones = (order.financials?.milestones || []).filter(
      (m: any) => m.trigger === "advance"
    );
    let requiredAdvancePaise = 0;
    if (advanceMilestones.length > 0) {
      requiredAdvancePaise = advanceMilestones.reduce(
        (sum: number, m: any) => sum + (m.amountPaise || 0),
        0
      );
    } else if (settings?.advancePct && order.quotation?.totalPaise) {
      requiredAdvancePaise = Math.round((order.quotation.totalPaise * settings.advancePct) / 100);
    }

    const advanceReceivedPaise = order.financials?.advanceReceivedPaise || 0;
    if (advanceReceivedPaise < requiredAdvancePaise) {
      if (!params.overrideReason || params.overrideReason.trim() === "") {
        throw new AppError(
          ErrorCode.ADVANCE_NOT_RECEIVED,
          `Advance milestone payment of ₹${(requiredAdvancePaise / 100).toFixed(
            2
          )} required before assignment (received: ₹${(advanceReceivedPaise / 100).toFixed(2)})`,
          400
        );
      }
    }

    // Validate each supervisor and their assigned processes
    const mappedAssignments: Array<{ supervisorId: any; processes: string[] }> = [];
    for (const a of params.assignments) {
      const user = await this.userRepo.findById(params.tenantId, a.supervisorId);
      if (!user) {
        throw new AppError(ErrorCode.NOT_FOUND, `Supervisor ${a.supervisorId} not found`, 404);
      }
      if (user.status !== "active") {
        throw new AppError(
          ErrorCode.VALIDATION_FAILED,
          `Supervisor ${user.name} is inactive or locked`,
          400
        );
      }

      const procs =
        a.processes && a.processes.length > 0
          ? a.processes
          : a.processArea
          ? [a.processArea]
          : [];

      if (procs.length === 0) {
        throw new AppError(
          ErrorCode.VALIDATION_FAILED,
          `No processes specified for supervisor ${user.name}`,
          400
        );
      }

      for (const p of procs) {
        if (!configuredAreas.has(p)) {
          throw new AppError(
            ErrorCode.VALIDATION_FAILED,
            `Process area '${p}' is not configured in tenant settings`,
            400
          );
        }
      }

      if (!params.overrideReason && user.role === "supervisor") {
        const userAreas = new Set(user.processAreas || []);
        for (const p of procs) {
          if (!userAreas.has(p)) {
            throw new AppError(
              ErrorCode.VALIDATION_FAILED,
              `Supervisor ${user.name} is not certified/assigned for process area '${p}'`,
              400
            );
          }
        }
      }

      mappedAssignments.push({ supervisorId: a.supervisorId, processes: procs });
    }

    return this.getUnitOfWork().withTransaction(async (tx) => {
      // Reserve stock for BOM if not already reserved
      const activeRes = (order.reservations || []).filter((r: any) => r.status === "active");
      if (activeRes.length === 0) {
        const materialReqs: Array<{ materialId: string; qty: number }> = [];

        if (
          order.feasibility?.materialRequirements &&
          order.feasibility.materialRequirements.length > 0
        ) {
          for (const req of order.feasibility.materialRequirements) {
            materialReqs.push({ materialId: String(req.materialId), qty: req.req });
          }
        } else if (order.productId) {
          const product = await this.productRepo.findById(params.tenantId, String(order.productId));
          if (product?.bom) {
            for (const item of product.bom) {
              const wastageMult = 1 + (item.wastage || 0) / 100;
              const reqQty = Math.ceil(item.qtyPerUnit * order.quantity * wastageMult);
              materialReqs.push({ materialId: String(item.materialId), qty: reqQty });
            }
          }
        }

        for (const req of materialReqs) {
          const updatedMat = await this.materialRepo.reserveStock(
            params.tenantId,
            req.materialId,
            req.qty,
            tx
          );
          if (!updatedMat) {
            throw new AppError(
              ErrorCode.VALIDATION_FAILED,
              `Insufficient unreserved stock for material ID ${req.materialId} (required: ${req.qty})`,
              400
            );
          }

          await this.stockMovementRepo.recordMovement(
            params.tenantId,
            {
              materialId: req.materialId,
              type: "reserve",
              qty: req.qty,
              qtyAfter: updatedMat.stockQty - updatedMat.reservedQty,
              orderId: params.orderId,
            },
            tx
          );

          await this.ordersRepo.addReservation(
            params.tenantId,
            params.orderId,
            {
              materialId: req.materialId,
              qty: req.qty,
              status: "active",
            },
            tx
          );
        }
      }

      await this.ordersRepo.assignProduction(
        params.tenantId,
        params.orderId,
        {
          assignedSupervisors: mappedAssignments,
          processPlan,
          assignedBy: params.actor.id as any,
        },
        tx
      );

      if (order.status !== OrderStatus.ASSIGNED) {
        await this.ordersRepo.updateStatus(
          params.tenantId,
          params.orderId,
          OrderStatus.ASSIGNED,
          {
            role: "admin",
            reason: params.overrideReason
              ? `Assigned with override: ${params.overrideReason}`
              : "Assigned supervisors to production plan",
            by: params.actor.id as any,
          },
          tx
        );
      }

      await this.auditService.log({
        tenantId: params.tenantId,
        actor: { id: params.actor.id, type: "user" },
        action: order.status === OrderStatus.ASSIGNED ? "ORDER_REASSIGNED" : "ORDER_ASSIGNED",
        entity: { collection: "orders", id: params.orderId },
        after: {
          assignedSupervisors: mappedAssignments,
          overrideReason: params.overrideReason,
        },
        requestId: params.actor.requestId,
      });

      for (const a of mappedAssignments) {
        await this.notificationRepo.createNotification(
          params.tenantId,
          {
            recipient: { userId: a.supervisorId },
            kind: "notification",
            type: "production_assignment",
            channel: "in_app",
            title: `Assigned to Order ${order.orderNumber}`,
            body: `You are assigned to order ${order.orderNumber} for stages: ${a.processes.join(
              ", "
            )}`,
            entity: { collection: "orders", id: params.orderId },
            dedupeKey: `assign_${order._id}_${a.supervisorId}`,
          },
          tx
        );

        await this.outboxRepo.createMessage(
          params.tenantId,
          {
            recipient: { userId: a.supervisorId },
            channel: "email",
            payload: {
              subject: `Assigned: Order ${order.orderNumber}`,
              orderNumber: order.orderNumber,
              processes: a.processes,
            },
          },
          tx
        );
      }

      const freshOrder = await this.ordersRepo.findById(
        params.tenantId,
        params.orderId,
        undefined,
        tx
      );
      return toAdminOrderDto(freshOrder);
    });
  }

  async startProduction(params: {
    tenantId: string;
    orderId: string;
    actor: { id: string; email?: string; ip?: string; requestId?: string; role?: "admin" | "supervisor" };
  }): Promise<any> {
    const order = await this.ordersRepo.findById(params.tenantId, params.orderId);
    if (!order) throw new AppError(ErrorCode.NOT_FOUND, "Order not found", 404);

    if (
      order.status !== OrderStatus.ASSIGNED &&
      order.status !== OrderStatus.IN_PRODUCTION
    ) {
      throw new AppError(
        ErrorCode.INVALID_TRANSITION,
        `Cannot start production on order with status '${order.status}'; must be 'assigned' or 'in_production'`,
        400
      );
    }

    if (params.actor.role === "supervisor") {
      const isAssigned = (order.production?.assignedSupervisors || []).some(
        (s: any) => String(s.supervisorId) === String(params.actor.id)
      );
      if (!isAssigned) {
        throw new AppError(
          ErrorCode.FORBIDDEN,
          "Access denied: Supervisor is not assigned to this order",
          403
        );
      }
    }

    return this.getUnitOfWork().withTransaction(async (tx) => {
      const updatedAck = await this.ordersRepo.acknowledgeAndStartProduction(
        params.tenantId,
        params.orderId,
        params.actor.id,
        tx
      );

      let finalOrder = updatedAck;

      if (order.status === OrderStatus.ASSIGNED) {
        finalOrder = await this.ordersRepo.updateStatus(
          params.tenantId,
          params.orderId,
          OrderStatus.IN_PRODUCTION,
          {
            role: params.actor.role || "supervisor",
            reason: "Production acknowledged and started",
            by: params.actor.id as any,
          },
          tx
        );
      }

      await this.auditService.log({
        tenantId: params.tenantId,
        actor: { id: params.actor.id, type: "user" },
        action: "ORDER_PRODUCTION_STARTED",
        entity: { collection: "orders", id: params.orderId },
        requestId: params.actor.requestId,
      });

      return toAdminOrderDto(finalOrder);
    });
  }

  async holdOrder(params: {
    tenantId: string;
    orderId: string;
    reason: string;
    actor: { id: string; email?: string; ip?: string; requestId?: string; type: "user" };
  }): Promise<any> {
    const order = await this.ordersRepo.findById(params.tenantId, params.orderId);
    if (!order) throw new AppError(ErrorCode.NOT_FOUND, "Order not found", 404);

    return this.getUnitOfWork().withTransaction(async (tx) => {
      const updated = await this.ordersRepo.updateStatus(
        params.tenantId,
        params.orderId,
        OrderStatus.ON_HOLD,
        {
          role: "admin",
          reason: params.reason,
          by: params.actor.id as any,
        },
        tx
      );

      await this.auditService.log({
        tenantId: params.tenantId,
        actor: { id: params.actor.id, type: "user" },
        action: "ORDER_HELD",
        entity: { collection: "orders", id: params.orderId },
        after: { reason: params.reason },
        requestId: params.actor.requestId,
      });

      return toAdminOrderDto(updated);
    });
  }

  async resumeOrder(params: {
    tenantId: string;
    orderId: string;
    actor: { id: string; email?: string; ip?: string; requestId?: string; type: "user" };
  }): Promise<any> {
    const order = await this.ordersRepo.findById(params.tenantId, params.orderId);
    if (!order) throw new AppError(ErrorCode.NOT_FOUND, "Order not found", 404);

    if (order.status !== OrderStatus.ON_HOLD) {
      throw new AppError(
        ErrorCode.INVALID_TRANSITION,
        `Cannot resume order with status '${order.status}'; must be 'on_hold'`,
        400
      );
    }

    const targetStatus =
      order.production?.assignmentStatus === "started"
        ? OrderStatus.IN_PRODUCTION
        : OrderStatus.ASSIGNED;

    return this.getUnitOfWork().withTransaction(async (tx) => {
      const updated = await this.ordersRepo.updateStatus(
        params.tenantId,
        params.orderId,
        targetStatus,
        {
          role: "admin",
          reason: "Order resumed by admin",
          by: params.actor.id as any,
        },
        tx
      );

      await this.auditService.log({
        tenantId: params.tenantId,
        actor: { id: params.actor.id, type: "user" },
        action: "ORDER_RESUMED",
        entity: { collection: "orders", id: params.orderId },
        after: { targetStatus },
        requestId: params.actor.requestId,
      });

      return toAdminOrderDto(updated);
    });
  }

  async cancelOrder(params: {
    tenantId: string;
    orderId: string;
    reason: string;
    actor: { id: string; email?: string; ip?: string; requestId?: string; type: "user" };
  }): Promise<any> {
    const order = await this.ordersRepo.findById(params.tenantId, params.orderId);
    if (!order) throw new AppError(ErrorCode.NOT_FOUND, "Order not found", 404);

    return this.getUnitOfWork().withTransaction(async (tx) => {
      const activeRes = (order.reservations || []).filter((r: any) => r.status === "active");
      for (const res of activeRes) {
        await this.materialRepo.releaseStock(
          params.tenantId,
          String(res.materialId),
          res.qty,
          tx
        );
        await this.stockMovementRepo.recordMovement(
          params.tenantId,
          {
            materialId: String(res.materialId),
            type: "release",
            qty: res.qty,
            qtyAfter: 0,
            orderId: params.orderId,
          },
          tx
        );
      }
      await this.ordersRepo.releaseReservations(params.tenantId, params.orderId, tx);

      const updated = await this.ordersRepo.updateStatus(
        params.tenantId,
        params.orderId,
        OrderStatus.CANCELLED,
        {
          role: "admin",
          reason: params.reason,
          by: params.actor.id as any,
        },
        tx
      );

      await this.auditService.log({
        tenantId: params.tenantId,
        actor: { id: params.actor.id, type: "user" },
        action: "ORDER_CANCELLED",
        entity: { collection: "orders", id: params.orderId },
        after: { reason: params.reason },
        requestId: params.actor.requestId,
      });

      return toAdminOrderDto(updated);
    });
  }

  async markReadyForDelivery(params: {
    tenantId: string;
    orderId: string;
    actor: { id: string; email?: string; ip?: string; requestId?: string; type: "user" };
  }): Promise<any> {
    const order = await this.ordersRepo.findById(params.tenantId, params.orderId);
    if (!order) throw new AppError(ErrorCode.NOT_FOUND, "Order not found", 404);

    if (order.status !== OrderStatus.IN_PRODUCTION) {
      throw new AppError(
        ErrorCode.INVALID_TRANSITION,
        `Cannot mark ready for delivery: order is in '${order.status}' status, must be 'in_production'`,
        400
      );
    }

    return this.getUnitOfWork().withTransaction(async (tx) => {
      const updated = await this.ordersRepo.updateStatus(
        params.tenantId,
        params.orderId,
        OrderStatus.READY_FOR_DELIVERY,
        {
          role: "admin",
          reason: "Marked ready for delivery by admin",
          by: params.actor.id as any,
        },
        tx
      );

      await this.auditService.log({
        tenantId: params.tenantId,
        actor: { id: params.actor.id, type: "user" },
        action: "ORDER_READY_FOR_DELIVERY",
        entity: { collection: "orders", id: params.orderId },
        requestId: params.actor.requestId,
      });

      return toAdminOrderDto(updated);
    });
  }

  async createPaymentOrder(params: {
    tenantId: string;
    orderId: string;
    milestoneIndex?: number;
    notes?: Record<string, string>;
    isClient?: boolean;
    clientId?: string;
  }): Promise<any> {
    const order = await this.ordersRepo.findById(params.tenantId, params.orderId);
    if (!order) throw new AppError(ErrorCode.NOT_FOUND, "Order not found", 404);

    if (params.isClient && params.clientId && String(order.clientId) !== params.clientId) {
      throw new AppError(ErrorCode.NOT_FOUND, "Order not found", 404);
    }

    const milestones = order.financials?.milestones || [];
    let mIndex = params.milestoneIndex;
    if (mIndex === undefined) {
      mIndex = milestones.findIndex((m: any) => m.status !== "received");
      if (mIndex === -1) mIndex = 0;
    }

    const milestone = milestones[mIndex];
    if (!milestone) {
      throw new AppError(ErrorCode.NOT_FOUND, `Milestone index ${mIndex} not found on order`, 404);
    }

    const receivedPaise = milestone.receivedPaise || 0;
    const amountDue = milestone.amountPaise - receivedPaise;
    if (amountDue <= 0) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, "Milestone is already fully paid", 400);
    }

    const gatewayResult = await this.getPaymentGateway().createOrder({
      amountPaise: amountDue,
      currency: "INR",
      receipt: `order_${order._id}_m${mIndex}`,
      notes: {
        orderId: params.orderId,
        tenantId: params.tenantId,
        milestoneIndex: String(mIndex),
        ...(params.notes || {}),
      },
    });

    await this.ordersRepo.setMilestoneRazorpayOrderId(
      params.tenantId,
      params.orderId,
      mIndex,
      gatewayResult.gatewayOrderId
    );

    const env = getContainer().env;
    return {
      gatewayOrderId: gatewayResult.gatewayOrderId,
      amountPaise: gatewayResult.amountPaise,
      currency: gatewayResult.currency,
      status: gatewayResult.status,
      milestoneIndex: mIndex,
      keyId: env.RAZORPAY_KEY_ID || "rzp_test_key",
    };
  }

  async recordManualReceipt(params: {
    tenantId: string;
    orderId: string;
    milestoneIndex: number;
    amountPaise: number;
    method?: "razorpay" | "neft" | "rtgs" | "upi" | "cheque" | "cash";
    mode?: "razorpay" | "neft" | "rtgs" | "upi" | "cheque" | "cash";
    ref: string;
    date?: string;
    notes?: string;
    actor: { id: string; email?: string; ip?: string; requestId?: string; type: "user" };
  }): Promise<any> {
    const order = await this.ordersRepo.findById(params.tenantId, params.orderId);
    if (!order) throw new AppError(ErrorCode.NOT_FOUND, "Order not found", 404);

    const milestone = order.financials?.milestones?.[params.milestoneIndex];
    if (!milestone) {
      throw new AppError(
        ErrorCode.NOT_FOUND,
        `Milestone index ${params.milestoneIndex} not found`,
        404
      );
    }

    const currentReceived = milestone.receivedPaise || 0;
    if (currentReceived + params.amountPaise > milestone.amountPaise) {
      throw new AppError(
        ErrorCode.OVERPAYMENT,
        `Payment amount of ₹${(params.amountPaise / 100).toFixed(
          2
        )} exceeds remaining due of ₹${(
          (milestone.amountPaise - currentReceived) /
          100
        ).toFixed(2)} for milestone '${milestone.milestone}'`,
        400
      );
    }

    const paymentMethod = params.method || params.mode || "neft";
    const paymentDate = params.date || getTodayBusinessDate();

    return this.getUnitOfWork().withTransaction(async (tx) => {
      const updated = await this.ordersRepo.recordPaymentReceipt(
        params.tenantId,
        params.orderId,
        params.milestoneIndex,
        {
          amountPaise: params.amountPaise,
          method: paymentMethod,
          ref: params.ref,
          date: paymentDate,
          by: params.actor.id as any,
        },
        tx
      );

      if (updated.status === OrderStatus.DELIVERED) {
        const allReceived = (updated.financials?.milestones || []).every(
          (m: any) => m.status === "received"
        );
        if (allReceived) {
          const activeRes = (updated.reservations || []).filter((r: any) => r.status === "active");
          for (const res of activeRes) {
            await this.materialRepo.releaseStock(
              params.tenantId,
              String(res.materialId),
              res.qty,
              tx
            );
            await this.stockMovementRepo.recordMovement(
              params.tenantId,
              {
                materialId: String(res.materialId),
                type: "release",
                qty: res.qty,
                qtyAfter: 0,
                orderId: params.orderId,
              },
              tx
            );
          }
          await this.ordersRepo.releaseReservations(params.tenantId, params.orderId, tx);
          await this.ordersRepo.updateStatus(
            params.tenantId,
            params.orderId,
            OrderStatus.COMPLETED,
            {
              role: "admin",
              reason: "All milestone payments received upon delivery completion",
              by: params.actor.id as any,
            },
            tx
          );
        }
      }

      await this.auditService.log({
        tenantId: params.tenantId,
        actor: { id: params.actor.id, type: "user" },
        action: "PAYMENT_RECEIPT_RECORDED",
        entity: { collection: "orders", id: params.orderId },
        after: {
          milestoneIndex: params.milestoneIndex,
          amountPaise: params.amountPaise,
          method: paymentMethod,
          ref: params.ref,
        },
        requestId: params.actor.requestId,
      });

      const adminUser = await this.userRepo.findOne(params.tenantId, { role: "admin" }, tx);
      await this.notificationRepo.createNotification(
        params.tenantId,
        {
          recipient: { userId: adminUser ? String(adminUser._id) : undefined },
          kind: "notification",
          type: "payment_received",
          channel: "in_app",
          title: `Payment Received for Order ${order.orderNumber}`,
          body: `Receipt of ₹${(params.amountPaise / 100).toFixed(2)} recorded for milestone '${
            milestone.milestone
          }' (${paymentMethod.toUpperCase()})`,
          entity: { collection: "orders", id: params.orderId },
          dedupeKey: `receipt_${params.orderId}_${params.ref}`,
        },
        tx
      );

      const freshOrder = await this.ordersRepo.findById(params.tenantId, params.orderId);
      return toAdminOrderDto(freshOrder);
    });
  }

  async reverseReceipt(params: {
    tenantId: string;
    orderId: string;
    milestoneIndex: number;
    receiptIndex?: number;
    receiptRef?: string;
    reason: string;
    actor: { id: string; email?: string; ip?: string; requestId?: string; type: "user" };
  }): Promise<any> {
    const order = await this.ordersRepo.findById(params.tenantId, params.orderId);
    if (!order) throw new AppError(ErrorCode.NOT_FOUND, "Order not found", 404);

    const milestone = order.financials?.milestones?.[params.milestoneIndex];
    if (!milestone) {
      throw new AppError(
        ErrorCode.NOT_FOUND,
        `Milestone index ${params.milestoneIndex} not found`,
        404
      );
    }

    let rIndex = params.receiptIndex;
    if (rIndex === undefined && params.receiptRef) {
      rIndex = milestone.receipts?.findIndex(
        (r: any) => r.ref === params.receiptRef && !r.reversedAt
      );
    }
    if (rIndex === undefined || rIndex < 0 || !milestone.receipts?.[rIndex]) {
      throw new AppError(ErrorCode.NOT_FOUND, "Receipt not found for reversal", 404);
    }

    return this.getUnitOfWork().withTransaction(async (tx) => {
      const updated = await this.ordersRepo.reversePaymentReceipt(
        params.tenantId,
        params.orderId,
        params.milestoneIndex,
        rIndex!,
        params.reason,
        tx
      );

      await this.auditService.log({
        tenantId: params.tenantId,
        actor: { id: params.actor.id, type: "user" },
        action: "PAYMENT_RECEIPT_REVERSED",
        entity: { collection: "orders", id: params.orderId },
        after: {
          milestoneIndex: params.milestoneIndex,
          receiptIndex: rIndex,
          reason: params.reason,
        },
        requestId: params.actor.requestId,
      });

      return toAdminOrderDto(updated);
    });
  }

  async processRazorpayWebhook(
    payload: any,
    signatureHeader?: string
  ): Promise<{ received: boolean; deduplicated?: boolean }> {
    const event = this.getPaymentGateway().parseWebhook(payload, signatureHeader);

    if (event.eventType === "payment.captured") {
      const paymentId = event.paymentId;
      const gatewayOrderId = event.gatewayOrderId;
      const orderId = event.notes?.orderId;
      const tenantId = event.notes?.tenantId;

      let order: any = null;
      if (tenantId && orderId) {
        order = await this.ordersRepo.findById(tenantId, orderId);
      }
      if (!order && gatewayOrderId) {
        order = await this.ordersRepo.findByRazorpayOrderId(gatewayOrderId);
      }

      if (!order) {
        logger.warn({ gatewayOrderId, paymentId }, "Razorpay webhook order not found");
        return { received: true };
      }

      let mIndex = event.notes?.milestoneIndex ? Number(event.notes.milestoneIndex) : -1;
      if (mIndex < 0 && gatewayOrderId) {
        mIndex = (order.financials?.milestones || []).findIndex(
          (m: any) => m.razorpayOrderId === gatewayOrderId
        );
      }
      if (mIndex < 0) mIndex = 0;

      const milestone = order.financials?.milestones?.[mIndex];
      if (!milestone) {
        logger.warn({ orderNumber: order.orderNumber, mIndex }, "Milestone not found for webhook");
        return { received: true };
      }

      // Check deduplication
      const alreadyRecorded = milestone.receipts?.some(
        (r: any) => r.razorpayPaymentId === paymentId
      );
      if (alreadyRecorded) {
        return { received: true, deduplicated: true };
      }

      const paymentDate = getTodayBusinessDate();

      await this.getUnitOfWork().withTransaction(async (tx) => {
        const updated = await this.ordersRepo.recordPaymentReceipt(
          order.tenantId,
          String(order._id),
          mIndex,
          {
            amountPaise: event.amountPaise,
            method: "razorpay",
            ref: paymentId,
            razorpayPaymentId: paymentId,
            date: paymentDate,
          },
          tx
        );

        if (updated.status === OrderStatus.DELIVERED) {
          const allReceived = (updated.financials?.milestones || []).every(
            (m: any) => m.status === "received"
          );
          if (allReceived) {
            const activeRes = (updated.reservations || []).filter((r: any) => r.status === "active");
            for (const res of activeRes) {
              await this.materialRepo.releaseStock(
                order.tenantId,
                String(res.materialId),
                res.qty,
                tx
              );
              await this.stockMovementRepo.recordMovement(
                order.tenantId,
                {
                  materialId: String(res.materialId),
                  type: "release",
                  qty: res.qty,
                  qtyAfter: 0,
                  orderId: String(order._id),
                },
                tx
              );
            }
            await this.ordersRepo.releaseReservations(order.tenantId, String(order._id), tx);
            await this.ordersRepo.updateStatus(
              order.tenantId,
              String(order._id),
              OrderStatus.COMPLETED,
              {
                role: "admin",
                reason: "All milestone payments completed via Razorpay",
              },
              tx
            );
          }
        }

        await this.auditService.log({
          tenantId: order.tenantId,
          actor: { id: "razorpay_webhook", type: "system" },
          action: "RAZORPAY_PAYMENT_CAPTURED",
          entity: { collection: "orders", id: String(order._id) },
          after: {
            milestoneIndex: mIndex,
            amountPaise: event.amountPaise,
            paymentId,
            gatewayOrderId,
          },
        });

        const adminUser = await this.userRepo.findOne(order.tenantId, { role: "admin" }, tx);
        await this.notificationRepo.createNotification(
          order.tenantId,
          {
            recipient: { userId: adminUser ? String(adminUser._id) : undefined },
            kind: "notification",
            type: "razorpay_payment_captured",
            channel: "in_app",
            title: `Razorpay Payment Received: ${order.orderNumber}`,
            body: `₹${(event.amountPaise / 100).toFixed(
              2
            )} received via Razorpay for milestone '${milestone.milestone}'`,
            entity: { collection: "orders", id: String(order._id) },
            dedupeKey: `rzp_receipt_${paymentId}`,
          },
          tx
        );
      });

      return { received: true };
    }

    if (event.eventType === "payment.failed") {
      logger.warn({ event }, "Razorpay payment failed webhook received");
      return { received: true };
    }

    return { received: true };
  }

  async recordDelivery(params: {
    tenantId: string;
    orderId: string;
    deliveryDate: string;
    qty: number;
    invoiceNo: string;
    invoiceAmountPaise: number;
    notes?: string;
    actor: { id: string; email?: string; ip?: string; requestId?: string; type: "user" };
  }): Promise<any> {
    const order = await this.ordersRepo.findById(params.tenantId, params.orderId);
    if (!order) throw new AppError(ErrorCode.NOT_FOUND, "Order not found", 404);

    const allowedStatuses: OrderStatus[] = [
      OrderStatus.IN_PRODUCTION,
      OrderStatus.READY_FOR_DELIVERY,
      OrderStatus.PARTIALLY_DELIVERED,
    ];
    if (!allowedStatuses.includes(order.status)) {
      throw new AppError(
        ErrorCode.INVALID_TRANSITION,
        `Cannot record delivery on order with status '${order.status}'; must be in_production, ready_for_delivery or partially_delivered`,
        400
      );
    }

    const alreadyDelivered = order.production?.deliveredQty || 0;
    const remaining = order.quantity - alreadyDelivered;
    if (params.qty > remaining) {
      throw new AppError(
        ErrorCode.VALIDATION_FAILED,
        `Delivery quantity ${params.qty} exceeds remaining unfulfilled quantity (${remaining})`,
        400
      );
    }

    const previousInvoicedPaise = (order.deliveries || []).reduce(
      (sum: number, d: any) => sum + (d.invoiceAmountPaise || 0),
      0
    );
    const orderTotalPaise = order.quotation?.totalPaise || 0;
    if (orderTotalPaise > 0 && previousInvoicedPaise + params.invoiceAmountPaise > orderTotalPaise) {
      throw new AppError(
        ErrorCode.INVOICE_EXCEEDS_ORDER_VALUE,
        `Cumulative invoice amount ₹${(
          (previousInvoicedPaise + params.invoiceAmountPaise) /
          100
        ).toFixed(2)} exceeds total order value ₹${(orderTotalPaise / 100).toFixed(2)}`,
        400
      );
    }

    // Compute onTime and delayDays from business dates
    const deliveryMs = new Date(params.deliveryDate).getTime();
    const deadlineMs = new Date(order.deliveryDeadline).getTime();
    const onTime = deliveryMs <= deadlineMs;
    const delayDays = onTime
      ? 0
      : Math.max(0, Math.ceil((deliveryMs - deadlineMs) / (1000 * 60 * 60 * 24)));

    const newDeliveredQty = alreadyDelivered + params.qty;
    const isFullyDelivered = newDeliveredQty >= order.quantity;

    return this.getUnitOfWork().withTransaction(async (tx) => {
      await this.ordersRepo.addDelivery(
        params.tenantId,
        params.orderId,
        {
          deliveryDate: params.deliveryDate,
          qty: params.qty,
          invoiceNo: params.invoiceNo,
          invoiceAmountPaise: params.invoiceAmountPaise,
          onTime,
          delayDays,
          recordedBy: params.actor.id as any,
        },
        tx
      );

      let nextStatus: OrderStatus;
      if (!isFullyDelivered) {
        nextStatus = OrderStatus.PARTIALLY_DELIVERED;
      } else {
        const allMilestonesReceived =
          (order.financials?.milestones || []).length > 0 &&
          (order.financials?.milestones || []).every((m: any) => m.status === "received");

        if (allMilestonesReceived) {
          nextStatus = OrderStatus.COMPLETED;
          const activeRes = (order.reservations || []).filter((r: any) => r.status === "active");
          for (const res of activeRes) {
            await this.materialRepo.releaseStock(
              params.tenantId,
              String(res.materialId),
              res.qty,
              tx
            );
            await this.stockMovementRepo.recordMovement(
              params.tenantId,
              {
                materialId: String(res.materialId),
                type: "release",
                qty: res.qty,
                qtyAfter: 0,
                orderId: params.orderId,
              },
              tx
            );
          }
          await this.ordersRepo.releaseReservations(params.tenantId, params.orderId, tx);
        } else {
          nextStatus = OrderStatus.DELIVERED;
        }
      }

      const updated = await this.ordersRepo.updateStatus(
        params.tenantId,
        params.orderId,
        nextStatus,
        {
          role: "admin",
          reason: `Delivery recorded: ${params.qty} units dispatched on invoice ${params.invoiceNo}`,
          by: params.actor.id as any,
        },
        tx
      );

      await this.auditService.log({
        tenantId: params.tenantId,
        actor: { id: params.actor.id, type: "user" },
        action: "DELIVERY_RECORDED",
        entity: { collection: "orders", id: params.orderId },
        after: {
          qty: params.qty,
          invoiceNo: params.invoiceNo,
          invoiceAmountPaise: params.invoiceAmountPaise,
          onTime,
          delayDays,
          nextStatus,
        },
        requestId: params.actor.requestId,
      });

      await this.notificationRepo.createNotification(
        params.tenantId,
        {
          recipient: { clientId: String(order.clientId) },
          kind: "notification",
          type: "shipment_dispatched",
          channel: "in_app",
          title: `Shipment Dispatched: Order ${order.orderNumber}`,
          body: `${params.qty} units have been dispatched on invoice ${params.invoiceNo}.`,
          entity: { collection: "orders", id: params.orderId },
          dedupeKey: `delivery_${params.orderId}_${params.invoiceNo}`,
        },
        tx
      );

      await this.outboxRepo.createMessage(
        params.tenantId,
        {
          recipient: { clientId: String(order.clientId) },
          channel: "email",
          payload: {
            subject: `Shipment Dispatched: Order ${order.orderNumber}`,
            orderNumber: order.orderNumber,
            qty: params.qty,
            invoiceNo: params.invoiceNo,
          },
        },
        tx
      );

      return toAdminOrderDto(updated);
    });
  }

  async checkOverduePayments(tenantId?: string): Promise<number> {
    const today = getTodayBusinessDate();
    const orders = await this.ordersRepo.findOrdersWithOverdueMilestones(tenantId, today);
    let overdueCount = 0;

    for (const order of orders) {
      const milestones = order.financials?.milestones || [];
      for (let i = 0; i < milestones.length; i++) {
        const m = milestones[i]!;
        if ((m.status === "pending" || m.status === "partial") && m.dueDate && m.dueDate < today) {
          await this.ordersRepo.setMilestoneOverdue(order.tenantId, String(order._id), i);
          overdueCount++;

          const adminUser = await this.userRepo.findOne(order.tenantId, { role: "admin" });
          await this.notificationRepo.createNotification(order.tenantId, {
            recipient: { userId: adminUser ? String(adminUser._id) : undefined },
            kind: "alert",
            type: "payment_overdue",
            channel: "in_app",
            title: `Payment Overdue: Order ${order.orderNumber}`,
            body: `Milestone '${m.milestone}' of ₹${(m.amountPaise / 100).toFixed(
              2
            )} is overdue since ${m.dueDate}`,
            entity: { collection: "orders", id: String(order._id) },
            dedupeKey: `overdue_${order._id}_m${i}_${m.dueDate}`,
          });
        }
      }
    }

    return overdueCount;
  }
}
