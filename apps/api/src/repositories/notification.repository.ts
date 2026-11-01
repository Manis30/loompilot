import { Types } from "mongoose";
import { BaseRepository } from "./base.repository.js";
import { INotification, NotificationModel } from "../models/platform/notification.model.js";
import { TxContext } from "../interfaces/unit-of-work.interface.js";
import { PaginationQuery, PaginatedResult } from "../utils/pagination.js";

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

  async findForUser(
    tenantId: string,
    userId: string,
    filter: { unreadOnly?: boolean; kind?: string } = {},
    pagination: Partial<PaginationQuery> = {}
  ): Promise<PaginatedResult<INotification>> {
    const queryFilter: Record<string, any> = {
      tenantId,
      "recipient.userId": new Types.ObjectId(userId),
    };

    if (filter.unreadOnly) {
      queryFilter.readAt = null;
    }
    if (filter.kind) {
      queryFilter.kind = filter.kind;
    }

    const page = Math.max(1, pagination.page || 1);
    const limit = Math.min(100, Math.max(1, pagination.limit || 20));
    const skip = (page - 1) * limit;

    const [items, totalItems] = await Promise.all([
      this.model
        .find(queryFilter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean<INotification[]>()
        .exec(),
      this.model.countDocuments(queryFilter).exec(),
    ]);

    const totalPages = Math.ceil(totalItems / limit) || 1;

    return {
      data: items,
      meta: {
        page,
        limit,
        total: totalItems,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async markAsRead(
    tenantId: string,
    notificationId: string,
    userId: string
  ): Promise<INotification | null> {
    return this.model
      .findOneAndUpdate(
        {
          tenantId,
          _id: notificationId,
          "recipient.userId": new Types.ObjectId(userId),
        },
        {
          $set: { readAt: new Date() },
          $inc: { version: 1 },
        },
        { new: true }
      )
      .lean<INotification>()
      .exec();
  }
}
