import { Request, Response, NextFunction } from "express";
import { AuditService } from "../services/audit.service.js";

const auditService = new AuditService();

export class AuditController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.actor!.tenantId;
      const { entity, actorId, actorType, action, dateFrom, dateTo, page, limit } = req.query;

      const pageNum = page ? parseInt(String(page), 10) : 1;
      const limitNum = limit ? parseInt(String(limit), 10) : 50;

      const result = await auditService.getLogs(
        tenantId,
        {
          entity: entity ? String(entity) : undefined,
          actorId: actorId ? String(actorId) : undefined,
          actorType: actorType ? String(actorType) : undefined,
          action: action ? String(action) : undefined,
          dateFrom: dateFrom ? String(dateFrom) : undefined,
          dateTo: dateTo ? String(dateTo) : undefined,
        },
        pageNum,
        limitNum
      );

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

