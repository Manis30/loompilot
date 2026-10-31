import { Types } from "mongoose";
import { BaseRepository } from "./base.repository.js";
import { IOutboxMessage, OutboxMessageModel } from "../models/platform/outbox-message.model.js";
import { TxContext } from "../interfaces/unit-of-work.interface.js";

export class OutboxRepository extends BaseRepository<IOutboxMessage> {
  constructor() {
    super(OutboxMessageModel);
  }

  async createMessage(
    tenantId: string,
    data: {
      recipient: { userId?: string; clientId?: string };
      channel: "email" | "whatsapp" | "sms";
      payload: Record<string, any>;
    },
    tx?: TxContext
  ): Promise<IOutboxMessage> {
    const recipientObj: any = {};
    if (data.recipient.userId) recipientObj.userId = new Types.ObjectId(data.recipient.userId);
    if (data.recipient.clientId) recipientObj.clientId = new Types.ObjectId(data.recipient.clientId);

    return this.create(
      tenantId,
      {
        recipient: recipientObj,
        channel: data.channel,
        status: "pending",
        attempts: 0,
        payload: data.payload,
        nextAttemptAt: new Date(),
        version: 1,
      } as any,
      tx
    );
  }
}
