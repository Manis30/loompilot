import { Types } from "mongoose";
import { ConversationRepository } from "../repositories/conversation.repository.js";
import { OrdersRepository } from "../repositories/orders.repository.js";
import { NotificationRepository } from "../repositories/notification.repository.js";
import { IAgentsClient } from "../interfaces/agents-client.interface.js";
import { IConversation, IConversationMessage } from "../models/interaction/conversation.model.js";
import { AppError } from "../errors/app-error.js";
import { ErrorCode } from "@loompilot/shared";

export class ConversationService {
  constructor(
    private readonly conversationRepo = new ConversationRepository(),
    private readonly ordersRepo = new OrdersRepository(),
    private readonly notificationRepo = new NotificationRepository(),
    private readonly agentsClient?: IAgentsClient
  ) {}

  async getClientOrderChat(
    tenantId: string,
    clientId: string,
    orderId: string
  ): Promise<IConversation> {
    const order = await this.ordersRepo.findById(tenantId, orderId);
    if (!order) {
      throw new AppError(ErrorCode.NOT_FOUND, "Order not found", 404);
    }
    if (String(order.clientId) !== clientId) {
      throw new AppError(ErrorCode.FORBIDDEN, "Access denied to order conversation", 403);
    }

    let conv = await this.conversationRepo.findByOrderId(tenantId, orderId);
    if (!conv) {
      conv = await this.conversationRepo.create(tenantId, {
        tenantId,
        orderId: new Types.ObjectId(orderId),
        clientId: new Types.ObjectId(clientId),
        status: "agent_handling",
        messages: [
          {
            senderType: "assistant",
            text: `Welcome! I am your LoomPilot textile merchandiser concierge for order ${order.orderNumber}. I can answer questions on fabric specifications, delivery timelines, and standard volume price tiers.`,
            createdAt: new Date(),
          },
        ],
        lastMessageAt: new Date(),
        version: 1,
      } as any);
    }

    return conv;
  }

  async sendClientMessage(
    tenantId: string,
    clientId: string,
    orderId: string,
    text: string
  ): Promise<{ reply: string; conversation: IConversation }> {
    const conv = await this.getClientOrderChat(tenantId, clientId, orderId);
    const order = await this.ordersRepo.findById(tenantId, orderId);

    const clientMsg: IConversationMessage = {
      senderType: "client",
      text,
      createdAt: new Date(),
      visibility: "client_visible",
    };

    await this.conversationRepo.appendMessage(tenantId, String(conv._id), clientMsg);

    // Analyze intent for price discount / negotiation escalation
    const lowerText = text.toLowerCase();
    const isPriceNegotiation =
      lowerText.includes("discount") ||
      lowerText.includes("cheaper") ||
      lowerText.includes("reduce") ||
      lowerText.includes("price") ||
      lowerText.includes("concession") ||
      lowerText.includes("lower rate") ||
      lowerText.includes("rate");

    let assistantText = "";
    if (this.agentsClient) {
      try {
        const agentResult = await this.agentsClient.chatReply({
          tenantId,
          conversationId: String(conv._id),
          orderId,
          clientId,
          lastMessage: text,
          senderRole: "client",
        });
        if (agentResult.success && agentResult.data?.messageText) {
          assistantText = agentResult.data.messageText;
        }
      } catch (err) {
        // Fallback below
      }
    }

    if (!assistantText) {
      if (isPriceNegotiation) {
        assistantText =
          "Under LoomPilot commercial governance, AI concierge cannot independently authorize rate concessions. I have logged your request and escalated it directly to Senior Production Merchandising & Admin for approval.";
      } else {
        assistantText =
          `Thank you for your message regarding Order ${order?.orderNumber || orderId}. Our production schedule and materials are aligned with your delivery window.`;
      }
    }

    // If price negotiation is detected, flag escalation for Admin
    if (isPriceNegotiation && conv.status !== "escalated") {
      await this.conversationRepo.setEscalation(tenantId, String(conv._id), {
        type: "discount",
        summary: `Client requested rate concession on Order ${order?.orderNumber || orderId}: "${text}"`,
        status: "open",
        currentPricePaise: order?.quotation?.totalPaise,
      });

      // Dispatch notification to admin
      await this.notificationRepo.createNotification(tenantId, {
        recipient: { userId: "admin" },
        kind: "alert",
        type: "client_negotiation_escalation",
        channel: "in_app",
        title: `Discount Escalation: Order ${order?.orderNumber || orderId}`,
        body: `Client has requested a price concession on order ${order?.orderNumber || orderId}. Please review in Chat Escalations.`,
        entity: { collection: "orders", id: orderId },
      });
    }

    const assistantMsg: IConversationMessage = {
      senderType: "assistant",
      text: assistantText,
      createdAt: new Date(),
      visibility: "client_visible",
    };

    const updated = await this.conversationRepo.appendMessage(
      tenantId,
      String(conv._id),
      assistantMsg
    );

    return {
      reply: assistantText,
      conversation: updated || conv,
    };
  }

  async getAdminConversations(
    tenantId: string,
    filter: { status?: string; hasEscalation?: boolean } = {}
  ): Promise<IConversation[]> {
    return this.conversationRepo.findConversations(tenantId, filter);
  }

  async getConversationById(
    tenantId: string,
    conversationId: string
  ): Promise<IConversation> {
    const conv = await this.conversationRepo.findById(tenantId, conversationId);
    if (!conv) {
      throw new AppError(ErrorCode.NOT_FOUND, "Conversation not found", 404);
    }
    return conv;
  }

  async sendAdminMessage(
    tenantId: string,
    _adminUser: { id: string; name?: string },
    conversationId: string,
    text: string
  ): Promise<IConversation> {
    const conv = await this.getConversationById(tenantId, conversationId);

    const adminMsg: IConversationMessage = {
      senderType: "admin",
      text,
      createdAt: new Date(),
      visibility: "client_visible",
    };

    const updated = await this.conversationRepo.appendMessage(
      tenantId,
      conversationId,
      adminMsg
    );

    // Notify client of admin reply
    if (conv.clientId) {
      await this.notificationRepo.createNotification(tenantId, {
        recipient: { clientId: String(conv.clientId) },
        kind: "notification",
        type: "admin_chat_reply",
        channel: "in_app",
        title: "New Message from LoomPilot Merchandising",
        body: `Managing Merchandiser: "${text.slice(0, 100)}${text.length > 100 ? "..." : ""}"`,
        entity: { collection: "orders", id: String(conv.orderId) },
      });
    }

    return updated || conv;
  }

  async resolveAdminEscalation(
    tenantId: string,
    adminUser: { id: string; name?: string },
    conversationId: string,
    params: { approved: boolean; concessionPercent?: number; notes?: string }
  ): Promise<IConversation> {
    const conv = await this.getConversationById(tenantId, conversationId);
    const order = await this.ordersRepo.findById(tenantId, String(conv.orderId));

    const resolutionText = params.approved
      ? `Senior Management has approved a ${params.concessionPercent || 5}% concession for order ${order?.orderNumber || conv.orderId}. Revised pricing has been authorized.`
      : `Senior Management has reviewed your request. Due to locked raw material costs and yarn commitments, the current rate stands.`;

    const resolution = {
      by: adminUser.id,
      at: new Date(),
      outcome: params.approved ? "approved" : "rejected",
      notes: params.notes || (params.approved ? "Concession granted" : "Rate upheld"),
    };

    await this.conversationRepo.resolveEscalation(tenantId, conversationId, resolution);

    // Send closing admin message into thread
    return this.sendAdminMessage(tenantId, adminUser, conversationId, resolutionText);
  }
}
