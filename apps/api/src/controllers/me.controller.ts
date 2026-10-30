import { Request, Response, NextFunction } from "express";
import { UserService } from "../services/user.service.js";
import { ClientAccountService } from "../services/client-account.service.js";

const userService = new UserService();
const clientAccountService = new ClientAccountService();

export class MeController {
  static async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = req.actor!;

      if (actor.realm === "user") {
        const user = await userService.getProfile(actor.tenantId, actor.subjectId);
        res.status(200).json({ realm: "user", profile: user });
      } else {
        const account = await clientAccountService.getProfile(actor.tenantId, actor.subjectId);
        res.status(200).json({ realm: "client", profile: account });
      }
    } catch (err) {
      next(err);
    }
  }

  static async updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = req.actor!;
      const { name, phone, notificationPrefs } = req.body;
      const updates: any = {};

      if (name !== undefined) updates.name = name.trim();
      if (phone !== undefined) updates.phone = phone.trim();
      if (notificationPrefs !== undefined) updates.notificationPrefs = notificationPrefs;

      if (actor.realm === "user") {
        const updated = await userService.updateProfile(actor.tenantId, actor.subjectId, updates);
        res.status(200).json({ realm: "user", profile: updated });
      } else {
        const updated = await clientAccountService.updateProfile(actor.tenantId, actor.subjectId, updates);
        res.status(200).json({ realm: "client", profile: updated });
      }
    } catch (err) {
      next(err);
    }
  }
}
