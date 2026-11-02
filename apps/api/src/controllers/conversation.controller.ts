import { Request, Response, NextFunction } from "express";
import { ConversationService } from "../services/conversation.service.js";
import { IAgentsClient } from "../interfaces/agents-client.interface.js";
import { AppError } from "../errors/app-error.js";
import { ErrorCode } from "@loompilot/shared";

export class ConversationController {
  private service: ConversationService;

  constructor(agentsClient?: IAgentsClient) {
    this.service = new ConversationService(
      undefined,
      undefined,
      undefined,
      agentsClient
    );
  }

  // Client: GET /api/v1/client/orders/:id/chat
  getClientOrderChat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const tenantId = req.tenantId || actor.tenantId;
      const clientId = actor.clientId || actor.subjectId;
      const orderId = req.params.id!;

      const conv = await this.service.getClientOrderChat(tenantId, clientId, orderId);
      res.status(200).json({ success: true, data: conv });
    } catch (err) {
      next(err);
    }
  };

  // Client: POST /api/v1/client/orders/:id/chat
  sendClientOrderMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const tenantId = req.tenantId || actor.tenantId;
      const clientId = actor.clientId || actor.subjectId;
      const orderId = req.params.id!;
      const { message, text } = req.body;

      const messageContent = message || text;
      if (!messageContent || typeof messageContent !== "string") {
        throw new AppError(ErrorCode.VALIDATION_FAILED, "Message text is required", 400);
      }

      const result = await this.service.sendClientMessage(tenantId, clientId, orderId, messageContent.trim());
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  // Admin: GET /api/v1/conversations
  getAdminConversations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const tenantId = req.tenantId || actor.tenantId;
      const { status, hasEscalation } = req.query;

      const list = await this.service.getAdminConversations(tenantId, {
        status: status as string,
        hasEscalation: hasEscalation === "true",
      });

      res.status(200).json({ success: true, data: list });
    } catch (err) {
      next(err);
    }
  };

  // Admin: GET /api/v1/conversations/:id
  getConversationById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const tenantId = req.tenantId || actor.tenantId;
      const conversationId = req.params.id!;

      const conv = await this.service.getConversationById(tenantId, conversationId);
      res.status(200).json({ success: true, data: conv });
    } catch (err) {
      next(err);
    }
  };

  // Admin: POST /api/v1/conversations/:id/messages
  sendAdminMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const tenantId = req.tenantId || actor.tenantId;
      const conversationId = req.params.id!;
      const adminUser = { id: actor.subjectId, name: actor.email };
      const { message, text } = req.body;

      const messageContent = message || text;
      if (!messageContent || typeof messageContent !== "string") {
        throw new AppError(ErrorCode.VALIDATION_FAILED, "Message text is required", 400);
      }

      const conv = await this.service.sendAdminMessage(
        tenantId,
        adminUser,
        conversationId,
        messageContent.trim()
      );
      res.status(200).json({ success: true, data: conv });
    } catch (err) {
      next(err);
    }
  };

  // Admin: POST /api/v1/conversations/:id/escalations/resolve
  resolveAdminEscalation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const tenantId = req.tenantId || actor.tenantId;
      const conversationId = req.params.id!;
      const adminUser = { id: actor.subjectId, name: actor.email };
      const { approved, concessionPercent, notes } = req.body;

      if (approved === undefined) {
        throw new AppError(ErrorCode.VALIDATION_FAILED, "Field 'approved' boolean is required", 400);
      }

      const conv = await this.service.resolveAdminEscalation(
        tenantId,
        adminUser,
        conversationId,
        {
          approved: Boolean(approved),
          concessionPercent: typeof concessionPercent === "number" ? concessionPercent : undefined,
          notes,
        }
      );

      res.status(200).json({ success: true, data: conv });
    } catch (err) {
      next(err);
    }
  };
}
