import { Request, Response, NextFunction } from "express";
import { ClientAccountService } from "../services/client-account.service.js";

const clientAccountService = new ClientAccountService();

export class ClientAccountController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const accounts = await clientAccountService.listAccounts(req.actor!.tenantId);
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

      const result = await clientAccountService.reinviteClientAccount({
        tenantId: actor.tenantId,
        actorUserId: actor.subjectId,
        accountId: id as string,
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

  static async accept(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = req.actor!;
      const { id } = req.params;
      const { password } = req.body;

      const result = await clientAccountService.acceptClientPortal({
        tenantId: actor.tenantId,
        actorUserId: actor.subjectId,
        clientId: id as string,
        password,
        ip: req.ip,
        requestId: (req as any).id,
      });

      res.status(200).json(result);
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

      res.status(200).json(updated);
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

      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  }
}
