import { Request, Response, NextFunction } from "express";
import { ClientAccountService } from "../services/client-account.service.js";

const clientAccountService = new ClientAccountService();

export class ClientAccountController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const accounts = await clientAccountService.listAccounts(req.actor!.tenantId);
      const sanitized = accounts.map((a: any) => {
        const obj = a.toObject ? a.toObject() : a;
        delete (obj as any).passwordHash;
        return obj;
      });
      res.status(200).json({ items: sanitized, total: sanitized.length });
    } catch (err) {
      next(err);
    }
  }

  static async invite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = req.actor!;
      const { clientId, email, name, phone } = req.body;

      const result = await clientAccountService.inviteClientAccount({
        tenantId: actor.tenantId,
        actorUserId: actor.subjectId,
        clientId,
        email,
        name,
        phone,
        ip: req.ip,
        requestId: (req as any).id,
      });

      const obj = (result.account as any)?.toObject ? (result.account as any).toObject() : result.account;
      delete (obj as any).passwordHash;

      res.status(201).json({
        account: obj,
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

      const result = await clientAccountService.reinviteClientAccount({
        tenantId: actor.tenantId,
        actorUserId: actor.subjectId,
        accountId: id as string,
        ip: req.ip,
        requestId: (req as any).id,
      });

      const obj = (result.account as any)?.toObject ? (result.account as any).toObject() : result.account;
      if (obj) delete (obj as any).passwordHash;

      res.status(200).json({
        account: obj,
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

      const updated = await clientAccountService.lockClientAccount({
        tenantId: actor.tenantId,
        actorUserId: actor.subjectId,
        accountId: id as string,
        ip: req.ip,
        requestId: (req as any).id,
      });

      const obj = (updated as any)?.toObject ? (updated as any).toObject() : updated;
      if (obj) delete (obj as any).passwordHash;
      res.status(200).json(obj);
    } catch (err) {
      next(err);
    }
  }

  static async unlock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = req.actor!;
      const { id } = req.params;

      const updated = await clientAccountService.unlockClientAccount({
        tenantId: actor.tenantId,
        actorUserId: actor.subjectId,
        accountId: id as string,
        ip: req.ip,
        requestId: (req as any).id,
      });

      const obj = (updated as any)?.toObject ? (updated as any).toObject() : updated;
      if (obj) delete (obj as any).passwordHash;
      res.status(200).json(obj);
    } catch (err) {
      next(err);
    }
  }
}
