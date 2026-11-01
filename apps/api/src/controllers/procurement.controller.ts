import { Request, Response, NextFunction } from "express";
import { ProcurementService } from "../services/procurement.service.js";
import { parsePaginationQuery } from "../utils/pagination.js";
import { AppError } from "../errors/app-error.js";
import { ErrorCode } from "@loompilot/shared";

export class ProcurementController {
  constructor(private readonly procurementService = new ProcurementService()) {}

  listPurchaseDecisions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const pagination = parsePaginationQuery(req.query as any);
      const filter = {
        status: req.query.status as string | undefined,
        materialId: req.query.materialId as string | undefined,
        supplierId: req.query.supplierId as string | undefined,
        orderId: req.query.orderId as string | undefined,
        search: req.query.search as string | undefined,
      };

      const result = await this.procurementService.listPurchaseDecisions(
        actor.tenantId,
        filter,
        pagination
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  createPurchaseDecision = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const orderId = req.params.id || req.body.orderId;
      if (!orderId) {
        throw new AppError(ErrorCode.VALIDATION_FAILED, "orderId is required", 400);
      }
      const result = await this.procurementService.createPurchaseDecision({
        tenantId: actor.tenantId,
        orderId,
        actor: {
          id: actor.subjectId,
          email: actor.email,
          ip: req.ip,
          requestId: actor.requestId,
        },
        data: req.body,
      });
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  updatePurchaseDecision = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const decisionId = (req.params.decisionId || req.params.id) as string;
      const orderId = (req.body.orderId || req.query.orderId) as string | undefined;
      const result = await this.procurementService.updatePurchaseDecision({
        tenantId: actor.tenantId,
        orderId,
        decisionId,
        actor: {
          id: actor.subjectId,
          email: actor.email,
          ip: req.ip,
          requestId: actor.requestId,
        },
        data: req.body,
      });
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };
}
