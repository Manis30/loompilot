import { Request, Response, NextFunction } from "express";
import { UserService } from "../services/user.service.js";

const userService = new UserService();

export class UserController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await userService.listUsers(req.actor!.tenantId);
      // Strip password hashes from response
      const sanitized = users.map((u: any) => {
        const obj = u.toObject ? u.toObject() : u;
        delete (obj as any).passwordHash;
        return obj;
      });
      res.status(200).json({ items: sanitized, total: sanitized.length });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = req.actor!;
      const { email, name, password, role, phone, processAreas } = req.body;

      const created = await userService.createUser({
        tenantId: actor.tenantId,
        actorUserId: actor.subjectId,
        email,
        name,
        password,
        role,
        phone,
        processAreas,
        ip: req.ip,
        requestId: (req as any).id,
      });

      const obj = (created as any).toObject ? (created as any).toObject() : created;
      delete (obj as any).passwordHash;
      res.status(201).json(obj);
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = req.actor!;
      const { id } = req.params;
      const { name, phone, role, status, processAreas } = req.body;

      const updated = await userService.updateUser({
        tenantId: actor.tenantId,
        actorUserId: actor.subjectId,
        userId: id as string,
        name,
        phone,
        role,
        status,
        processAreas,
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

  static async lock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = req.actor!;
      const { id } = req.params;

      const updated = await userService.lockUser(
        actor.tenantId,
        actor.subjectId,
        id as string,
        req.ip,
        (req as any).id
      );

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

      const updated = await userService.unlockUser(
        actor.tenantId,
        actor.subjectId,
        id as string,
        req.ip,
        (req as any).id
      );

      const obj = (updated as any)?.toObject ? (updated as any).toObject() : updated;
      if (obj) delete (obj as any).passwordHash;
      res.status(200).json(obj);
    } catch (err) {
      next(err);
    }
  }
}
