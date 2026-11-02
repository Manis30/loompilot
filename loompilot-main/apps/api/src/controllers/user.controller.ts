import { Request, Response, NextFunction } from "express";
import { UserService } from "../services/user.service.js";
import { parsePaginationQuery } from "../utils/pagination.js";

const userService = new UserService();

export class UserController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = req.actor!;
      const pagination = parsePaginationQuery(req.query as any);
      const search = req.query.search as string | undefined;
      const role = req.query.role as "admin" | "supervisor" | undefined;
      const status = req.query.status as "active" | "locked" | undefined;
      const processArea = req.query.processArea as string | undefined;

      const result = await userService.listUsers(actor.tenantId, pagination, {
        search,
        role,
        status,
        processArea,
      });

      res.status(200).json({
        items: result.data,
        total: result.meta.total,
        data: result.data,
        meta: result.meta,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = req.actor!;
      const user = await userService.getUserById(actor.tenantId, req.params.id as string);
      res.status(200).json({ data: user });
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

      res.status(201).json(created);
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

      res.status(200).json(updated);
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

      res.status(200).json(updated);
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

      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  }
}
