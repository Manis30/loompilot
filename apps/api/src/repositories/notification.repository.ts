import { Types } from "mongoose";
import { BaseRepository } from "./base.repository.js";
import { INotification, NotificationModel } from "../models/platform/notification.model.js";
import { TxContext } from "../interfaces/unit-of-work.interface.js";

export class NotificationRepository extends BaseRepository<INotification> {
  constructor() {
    super(NotificationModel);
  }

  async createNotification(
    tenantId: string,
    data: {
      recipient: { userId?: string; clientId?: string };
      kind?: "notification" | "alert";
      type: string;
      channel: "in_app" | "email" | "whatsapp" | "sms";
      title: string;
      body: string;
      entity?: { collection: string; id: string };
      dedupeKey?: string;
    },
    tx?: TxContext
  ): Promise<INotification> {
    const recipientObj: any = {};
    if (data.recipient.userId) recipientObj.userId = new Types.ObjectId(data.recipient.userId);
    if (data.recipient.clientId) recipientObj.clientId = new Types.ObjectId(data.recipient.clientId);

    return this.create(
      tenantId,
      {
        recipient: recipientObj,
        kind: data.kind || "notification",
        type: data.type,
        channel: data.channel,
        status: "pending",
        attempts: 0,
        title: data.title,
        body: data.body,
        entity: data.entity,
        dedupeKey: data.dedupeKey,
        version: 1,
      } as any,
      tx
    );
  }
}
