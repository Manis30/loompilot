import { Request, Response } from "express";
import { ConversationService } from "../services/conversation.service.js";
import { IAgentsClient } from "../interfaces/agents-client.interface.js";

export class ConversationController {
  private readonly convService: ConversationService;

  constructor(serviceOrClient?: ConversationService | IAgentsClient) {
    if (serviceOrClient && "runAgent" in serviceOrClient) {
      this.convService = new ConversationService(undefined, undefined, undefined, serviceOrClient as IAgentsClient);
    } else if (serviceOrClient instanceof ConversationService) {
      this.convService = serviceOrClient;
    } else {
      this.convService = new ConversationService();
    }
  }

  // Aliases for route compatibility
  getClientOrderChat = (req: Request, res: Response): Promise<void> => this.getClientMessages(req, res);
  sendClientOrderMessage = (req: Request, res: Response): Promise<void> => this.postClientChat(req, res);
  getAdminConversations = (req: Request, res: Response): Promise<void> => this.getAdminMessages(req, res);
  getConversationById = (req: Request, res: Response): Promise<void> => this.getAdminMessages(req, res);
  sendAdminMessage = (req: Request, res: Response): Promise<void> => this.postAdminChat(req, res);
  resolveAdminEscalation = (req: Request, res: Response): Promise<void> => this.resolveEscalation(req, res);

  getClientMessages = async (req: Request, res: Response): Promise<void> => {
    const actor = req.actor!;
    const orderId = req.params.id as string;
    const clientId = actor.clientId || actor.subjectId;

    const conversation = await this.convService.getClientConversation(
      actor.tenantId,
      orderId,
      clientId
    );

    res.status(200).json({
      success: true,
      data: conversation,
    });
  };

  postClientChat = async (req: Request, res: Response): Promise<void> => {
    const actor = req.actor!;
    const orderId = req.params.id as string;
    const clientId = actor.clientId || actor.subjectId;
    const { message } = req.body;

    const result = await this.convService.postClientMessage(
      actor.tenantId,
      orderId,
      clientId,
      message
    );

    res.status(200).json({
      success: true,
      data: result.conversation,
      assistantReply: result.assistantReply,
    });
  };

  getAdminMessages = async (req: Request, res: Response): Promise<void> => {
    const actor = req.actor!;
    const orderId = req.params.id as string;

    const conversation = await this.convService.getAdminConversation(
      actor.tenantId,
      orderId
    );

    res.status(200).json({
      success: true,
      data: conversation,
    });
  };

  postAdminChat = async (req: Request, res: Response): Promise<void> => {
    const actor = req.actor!;
    const orderId = req.params.id as string;
    const { message } = req.body;

    const conversation = await this.convService.postAdminMessage(
      actor.tenantId,
      orderId,
      { id: actor.subjectId, email: actor.email },
      message
    );

    res.status(200).json({
      success: true,
      data: conversation,
    });
  };

  resolveEscalation = async (req: Request, res: Response): Promise<void> => {
    const actor = req.actor!;
    const orderId = req.params.id as string;
    const { approved, concessionPercent, notes } = req.body;

    const conversation = await this.convService.resolveEscalation(
      actor.tenantId,
      orderId,
      { id: actor.subjectId, email: actor.email },
      { approved: Boolean(approved), concessionPercent, notes }
    );

    res.status(200).json({
      success: true,
      data: conversation,
    });
  };
}
