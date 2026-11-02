import { Request, Response, NextFunction } from "express";
import { OrderService } from "../services/order.service.js";
import { parsePaginationQuery } from "../utils/pagination.js";

export class ClientNotificationController {
  constructor(private readonly orderService = new OrderService()) {}

  listNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const pagination = parsePaginationQuery(req.query as any);
      const filter = {
        unreadOnly: req.query.unreadOnly === "true",
        kind: req.query.kind as string | undefined,
        category: req.query.category as string | undefined,
      };

      const result = await this.orderService.listClientNotifications(
        actor.tenantId,
        actor.subjectId,
        filter,
        pagination
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  markAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const notificationId = req.params.id as string;
      const result = await this.orderService.markClientNotificationAsRead(
        actor.tenantId,
        notificationId,
        actor.subjectId
      );
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  markAllAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const result = await this.orderService.markAllClientNotificationsAsRead(
        actor.tenantId,
        actor.subjectId
      );
      res.json({ data: result, success: true });
    } catch (err) {
      next(err);
    }
  };
}

