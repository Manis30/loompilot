import { Types } from "mongoose";
import { BaseRepository } from "./base.repository.js";
import {
  ConversationModel,
  IConversation,
  IConversationMessage,
  IConversationEscalation,
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
    const filter = this.enforceTenant(tenantId, {
      orderId: Types.ObjectId.isValid(orderId) ? new Types.ObjectId(orderId) : orderId,
    });
    return this.model
      .findOne(filter)
      .session(session ?? null)
      .lean<IConversation>()
      .exec();
  }

  async findOrCreate(
    tenantId: string,
    orderId: string,
    clientId: string,
    tx?: TxContext
  ): Promise<IConversation> {
    const existing = await this.findByOrderId(tenantId, orderId, tx);
    if (existing) {
      return existing;
    }

    const session = this.getSession(tx);
    const created = await this.model.create(
      [
        {
          tenantId,
          orderId: new Types.ObjectId(orderId),
          clientId: new Types.ObjectId(clientId),
          status: "agent_handling",
          messages: [],
          lastMessageAt: new Date(),
          version: 1,
        },
      ],
      { session: session ?? undefined }
    );

    const doc = created[0]!;
    return ((doc as any).toObject ? (doc as any).toObject() : doc) as IConversation;
  }

  async addMessage(
    tenantId: string,
    conversationId: string,
    message: IConversationMessage,
    tx?: TxContext
  ): Promise<IConversation | null> {
    const session = this.getSession(tx);
    const filter = this.enforceTenant(tenantId, { _id: conversationId });
    return this.model
      .findOneAndUpdate(
        filter,
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

  async updateConversationStatus(
    tenantId: string,
    conversationId: string,
    status: IConversation["status"],
    assignedAdminId?: string,
    tx?: TxContext
  ): Promise<IConversation | null> {
    const session = this.getSession(tx);
    const filter = this.enforceTenant(tenantId, { _id: conversationId });
    const update: any = { status };
    if (assignedAdminId) {
      update.assignedAdminId = new Types.ObjectId(assignedAdminId);
    }
    return this.model
      .findOneAndUpdate(
        filter,
        { $set: update, $inc: { version: 1 } },
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
    const filter = this.enforceTenant(tenantId, { _id: conversationId });
    return this.model
      .findOneAndUpdate(
        filter,
        {
          $set: {
            escalation,
            status: "escalated",
          },
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
    resolution: { by: string; outcome: string; notes?: string },
    tx?: TxContext
  ): Promise<IConversation | null> {
    const session = this.getSession(tx);
    const filter = this.enforceTenant(tenantId, { _id: conversationId });
    return this.model
      .findOneAndUpdate(
        filter,
        {
          $set: {
            "escalation.status": "resolved",
            "escalation.resolution": {
              by: new Types.ObjectId(resolution.by),
              at: new Date(),
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
