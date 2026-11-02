import { ConversationRepository } from "../repositories/conversation.repository.js";
import { OrdersRepository } from "../repositories/orders.repository.js";
import { AuditService } from "./audit.service.js";
import { AppError } from "../errors/app-error.js";
import { ErrorCode, InternalQuotationRevision } from "@loompilot/shared";
import { IAgentsClient } from "../interfaces/agents-client.interface.js";
import { getContainer } from "../container.js";
import { logger } from "../utils/logger.js";
import { IConversation, IConversationMessage } from "../models/interaction/conversation.model.js";

export class ConversationService {
  constructor(
    private readonly convRepo = new ConversationRepository(),
    private readonly ordersRepo = new OrdersRepository(),
    private readonly auditService = new AuditService(),
    private agentsClient?: IAgentsClient
  ) {}

  private getAgentsClient(): IAgentsClient {
    return this.agentsClient || getContainer().agentsClient;
  }

  async getClientConversation(tenantId: string, orderId: string, clientId: string): Promise<IConversation> {
    const order = await this.ordersRepo.findById(tenantId, orderId);
    if (!order) {
      throw new AppError(ErrorCode.NOT_FOUND, "Order not found", 404);
    }
    if (String(order.clientId) !== clientId) {
      throw new AppError(ErrorCode.FORBIDDEN, "Access denied: Order does not belong to client", 403);
    }

    return this.convRepo.findOrCreate(tenantId, orderId, clientId);
  }

  async postClientMessage(
    tenantId: string,
    orderId: string,
    clientId: string,
    text: string
  ): Promise<{ conversation: IConversation; assistantReply?: IConversationMessage }> {
    const order = await this.ordersRepo.findById(tenantId, orderId);
    if (!order) {
      throw new AppError(ErrorCode.NOT_FOUND, "Order not found", 404);
    }
    if (String(order.clientId) !== clientId) {
      throw new AppError(ErrorCode.FORBIDDEN, "Access denied: Order does not belong to client", 403);
    }

    const conv = await this.convRepo.findOrCreate(tenantId, orderId, clientId);

    const clientMsg: IConversationMessage = {
      senderType: "client",
      text: text.trim(),
      visibility: "client_visible",
      createdAt: new Date(),
    };

    let updatedConv = await this.convRepo.addMessage(tenantId, String(conv._id), clientMsg);

    const lower = text.toLowerCase();
    const isDiscountRequest =
      lower.includes("discount") ||
      lower.includes("concession") ||
      lower.includes("reduce") ||
      lower.includes("cheaper") ||
      lower.includes("lower") ||
      lower.includes("rebate") ||
      lower.includes("negotiate") ||
      lower.includes("better price") ||
      lower.includes("margin");

    let assistantMsg: IConversationMessage | undefined;

    if (isDiscountRequest) {
      // Per LoomPilot specification (Doc §3.6, §4):
      // The assistant never grants a discount or reveals cost/margin.
      // A concession request is escalated to the admin in the same chat.
      const currentPricePaise = order.quotation?.totalPaise || (order as any).quotedTotalPaise || 0;

      await this.convRepo.setEscalation(tenantId, String(conv._id), {
        type: "discount",
        summary: `Client requested volume discount on order ${order.orderNumber}: "${text.trim()}"`,
        currentPricePaise,
        status: "open",
      });

      const replyText =
        "Under LoomPilot mill governance, the AI concierge cannot independently authorize pricing discounts. I have formatted your concession request and escalated it directly to our Managing Director for executive review in this chat thread.";

      assistantMsg = {
        senderType: "assistant",
        text: replyText,
        visibility: "client_visible",
        createdAt: new Date(),
      };

      updatedConv = await this.convRepo.addMessage(tenantId, String(conv._id), assistantMsg);

      await this.auditService.log({
        tenantId,
        actor: { id: clientId, type: "client" },
        action: "DISCOUNT_REQUEST_ESCALATED",
        entity: { collection: "conversations", id: String(conv._id) },
        after: { orderId, text },
      });
    } else {
      // Call AI Agent for chat assistance
      try {
        const client = this.getAgentsClient();
        const agentResult = await client.chatReply({
          tenantId,
          conversationId: String(conv._id),
          orderId,
          clientId,
          lastMessage: text,
          senderRole: "client",
        });

        const replyText =
          agentResult?.data?.messageText ||
          "Thank you for your message. Your inquiry regarding order " +
            order.orderNumber +
            " has been logged with our mill production team.";

        assistantMsg = {
          senderType: "assistant",
          text: replyText,
          visibility: "client_visible",
          createdAt: new Date(),
        };

        updatedConv = await this.convRepo.addMessage(tenantId, String(conv._id), assistantMsg);
      } catch (err: any) {
        logger.warn({ err: err?.message, orderId }, "Agent chat reply fallback triggered");
        assistantMsg = {
          senderType: "assistant",
          text: "Thank you for reaching out. We have logged your query and our merchandising team will follow up shortly.",
          visibility: "client_visible",
          createdAt: new Date(),
        };
        updatedConv = await this.convRepo.addMessage(tenantId, String(conv._id), assistantMsg);
      }
    }

    return {
      conversation: updatedConv || conv,
      assistantReply: assistantMsg,
    };
  }

  async getAdminConversation(tenantId: string, orderId: string): Promise<IConversation> {
    const order = await this.ordersRepo.findById(tenantId, orderId);
    if (!order) {
      throw new AppError(ErrorCode.NOT_FOUND, "Order not found", 404);
    }
    return this.convRepo.findOrCreate(tenantId, orderId, String(order.clientId));
  }

  async postAdminMessage(
    tenantId: string,
    orderId: string,
    adminActor: { id: string; email?: string; name?: string },
    text: string
  ): Promise<IConversation> {
    const order = await this.ordersRepo.findById(tenantId, orderId);
    if (!order) {
      throw new AppError(ErrorCode.NOT_FOUND, "Order not found", 404);
    }

    const conv = await this.convRepo.findOrCreate(tenantId, orderId, String(order.clientId));

    const adminMsg: IConversationMessage = {
      senderType: "admin",
      text: text.trim(),
      visibility: "client_visible",
      createdAt: new Date(),
    };

    const updated = await this.convRepo.addMessage(tenantId, String(conv._id), adminMsg);

    // If conversation was escalated, update status to admin_handling
    if (conv.status === "escalated" || conv.status === "agent_handling") {
      await this.convRepo.updateConversationStatus(
        tenantId,
        String(conv._id),
        "admin_handling",
        adminActor.id
      );
    }

    await this.auditService.log({
      tenantId,
      actor: { id: adminActor.id, type: "user", email: adminActor.email },
      action: "ADMIN_CHAT_REPLY",
      entity: { collection: "conversations", id: String(conv._id) },
      after: { orderId, text: text.trim() },
    });

    return updated || conv;
  }

  async resolveEscalation(
    tenantId: string,
    orderId: string,
    adminActor: { id: string; email?: string },
    data: { approved: boolean; concessionPercent?: number; notes?: string }
  ): Promise<IConversation> {
    const order = await this.ordersRepo.findById(tenantId, orderId);
    if (!order) {
      throw new AppError(ErrorCode.NOT_FOUND, "Order not found", 404);
    }

    const conv = await this.convRepo.findOrCreate(tenantId, orderId, String(order.clientId));

    const concessionPct = data.concessionPercent || 5;
    let resolutionMessage = "";

    if (data.approved) {
      const oldPricePaise = order.quotation?.totalPaise || 0;
      const discountAmountPaise = Math.round((oldPricePaise * concessionPct) / 100);
      const newPricePaise = Math.max(0, oldPricePaise - discountAmountPaise);

      // Create official quotation revision on order
      const revisionDoc: InternalQuotationRevision = {
        schemaVersion: "1.0",
        tenantId,
        orderId,
        reasonType: "discount",
        oldPricePaise,
        newPricePaise,
        changePct: -concessionPct,
        clientReason: `Management approved a ${concessionPct}% concession in appreciation of our manufacturing partnership.`,
      };

      const currentRevisions = order.quotation?.revisions || [];
      const nextRevisionNo = currentRevisions.length + 1;

      await this.ordersRepo.addQuotationRevision(tenantId, orderId, {
        ...revisionDoc,
        revisionNo: nextRevisionNo,
        status: "sent",
        createdAt: new Date(),
      } as any);

      resolutionMessage = `Management has approved your discount request: A ${concessionPct}% concession has been authorized for order ${order.orderNumber}. A revised quotation (Revision #${nextRevisionNo}) has been issued for your review and acceptance.`;
    } else {
      resolutionMessage =
        data.notes ||
        `Management has reviewed your request for order ${order.orderNumber}. Due to current locked raw material rates and minimum margin constraints, we are unable to provide an additional discount at this stage.`;
    }

    // Append resolution message to conversation
    const adminMsg: IConversationMessage = {
      senderType: "admin",
      text: resolutionMessage,
      visibility: "client_visible",
      createdAt: new Date(),
    };

    await this.convRepo.addMessage(tenantId, String(conv._id), adminMsg);

    const updated = await this.convRepo.resolveEscalation(tenantId, String(conv._id), {
      by: adminActor.id,
      outcome: data.approved ? `Approved ${concessionPct}% discount` : "Declined",
      notes: data.notes,
    });

    await this.auditService.log({
      tenantId,
      actor: { id: adminActor.id, type: "user", email: adminActor.email },
      action: "ESCALATION_RESOLVED",
      entity: { collection: "conversations", id: String(conv._id) },
      after: { orderId, approved: data.approved, concessionPercent: concessionPct },
    });

    return updated || conv;
  }
}
