import { Types } from "mongoose";
import { BaseRepository } from "./base.repository.js";
import {
  IConversation,
  IConversationMessage,
  IConversationEscalation,
  ConversationModel,
} from "../models/interaction/conversation.model.js";
import { TxContext } from "../interfaces/unit-of-work.interface.js";

export class ConversationRepository extends BaseRepository<IConversation> {
  constructor() {
    super(ConversationModel);
  }

  async findByOrderId(
    tenantId: string,
    orderId: string,
    tx?: TxContext
  ): Promise<IConversation | null> {
    const session = this.getSession(tx);
    return this.model
      .findOne({
        tenantId,
        orderId: new Types.ObjectId(orderId),
      })
      .session(session ?? null)
      .lean<IConversation>()
      .exec();
  }

  async findConversations(
    tenantId: string,
    filter: { status?: string; hasEscalation?: boolean } = {},
    tx?: TxContext
  ): Promise<IConversation[]> {
    const session = this.getSession(tx);
    const query: any = { tenantId };
    if (filter.status) {
      query.status = filter.status;
    }
    if (filter.hasEscalation === true) {
      query["escalation.status"] = { $in: ["open", "in_progress"] };
    }

    return this.model
      .find(query)
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .session(session ?? null)
      .lean<IConversation[]>()
      .exec();
  }

  async appendMessage(
    tenantId: string,
    conversationId: string,
    message: IConversationMessage,
    tx?: TxContext
  ): Promise<IConversation | null> {
    const session = this.getSession(tx);
    return this.model
      .findOneAndUpdate(
        { tenantId, _id: new Types.ObjectId(conversationId) },
        {
          $push: { messages: message },
          $set: { lastMessageAt: message.createdAt || new Date() },
          $inc: { version: 1 },
        },
        { new: true, session: session ?? null }
      )
      .lean<IConversation>()
      .exec();
  }

  async setEscalation(
    tenantId: string,
    conversationId: string,
    escalation: IConversationEscalation,
    tx?: TxContext
  ): Promise<IConversation | null> {
    const session = this.getSession(tx);
    return this.model
      .findOneAndUpdate(
        { tenantId, _id: new Types.ObjectId(conversationId) },
        {
          $set: {
            escalation,
            status: "escalated",
          },
          $push: { escalationHistory: escalation },
          $inc: { version: 1 },
        },
        { new: true, session: session ?? null }
      )
      .lean<IConversation>()
      .exec();
  }

  async resolveEscalation(
    tenantId: string,
    conversationId: string,
    resolution: {
      by: string;
      at: Date;
      outcome: string;
      notes?: string;
    },
    tx?: TxContext
  ): Promise<IConversation | null> {
    const session = this.getSession(tx);
    return this.model
      .findOneAndUpdate(
        { tenantId, _id: new Types.ObjectId(conversationId) },
        {
          $set: {
            "escalation.status": "resolved",
            "escalation.resolution": {
              by: new Types.ObjectId(resolution.by),
              at: resolution.at,
              outcome: resolution.outcome,
              notes: resolution.notes,
            },
            status: "admin_handling",
          },
          $inc: { version: 1 },
        },
        { new: true, session: session ?? null }
      )
      .lean<IConversation>()
      .exec();
  }
}

