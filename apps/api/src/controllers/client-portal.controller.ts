import { Request, Response, NextFunction } from "express";
import { ClientPortalService } from "../services/client-portal.service.js";

const clientPortalService = new ClientPortalService();

export class ClientPortalController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const accounts = await clientPortalService.listAccounts(req.actor!.tenantId);
      res.status(200).json({ items: accounts, total: accounts.length });
    } catch (err) {
      next(err);
    }
  }

  static async invite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = req.actor!;
      const clientId = (req.params.id as string) || req.body.clientId;
      const { email, name, phone } = req.body;

      const result = await clientPortalService.inviteClientAccount({
        tenantId: actor.tenantId,
        actorUserId: actor.subjectId,
        clientId,
        email,
        name,
        phone,
        ip: req.ip,
        requestId: (req as any).id,
      });

      res.status(201).json({
        account: result.account,
        inviteToken: result.inviteToken,
        inviteLink: result.inviteLink,
      });
    } catch (err) {
      next(err);
    }
  }

  static async reinvite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = req.actor!;
      const { id } = req.params;

      const result = await clientPortalService.reinviteClientAccount({
        tenantId: actor.tenantId,
        actorUserId: actor.subjectId,
        clientId: id as string,
        ip: req.ip,
        requestId: (req as any).id,
      });

      res.status(200).json({
        account: result.account,
        inviteToken: result.inviteToken,
        inviteLink: result.inviteLink,
      });
    } catch (err) {
      next(err);
    }
  }

  static async lock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = req.actor!;
      const { id } = req.params;

      const updated = await clientPortalService.lockClientAccount({
        tenantId: actor.tenantId,
        actorUserId: actor.subjectId,
        clientId: id as string,
        ip: req.ip,
        requestId: (req as any).id,
      });

      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  }

  static async unlock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = req.actor!;
      const { id } = req.params;

      const updated = await clientPortalService.unlockClientAccount({
        tenantId: actor.tenantId,
        actorUserId: actor.subjectId,
        clientId: id as string,
        ip: req.ip,
        requestId: (req as any).id,
      });

      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  }
}
