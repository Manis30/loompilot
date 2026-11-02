import { Request, Response, NextFunction } from "express";
import { StockService } from "../services/stock.service.js";
import { parsePaginationQuery } from "../utils/pagination.js";

export class StockController {
  constructor(private readonly stockService = new StockService()) {}

  recordGoodsReceipt = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const result = await this.stockService.recordGoodsReceipt({
        tenantId: actor.tenantId,
        ...req.body,
        actor: {
          id: actor.subjectId,
          ip: req.ip,
          requestId: actor.requestId,
        },
      });
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  adjustStock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const result = await this.stockService.adjustStock({
        tenantId: actor.tenantId,
        ...req.body,
        actor: {
          id: actor.subjectId,
          ip: req.ip,
          requestId: actor.requestId,
        },
      });
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  consumeStock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const result = await this.stockService.consumeStock({
        tenantId: actor.tenantId,
        ...req.body,
        actor: {
          id: actor.subjectId,
          email: (actor as any).email,
          ip: req.ip,
          requestId: actor.requestId,
          role: actor.role,
        },
      });
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  getStockBalances = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const pagination = parsePaginationQuery(req.query as any);
      const result = await this.stockService.getStockBalances(actor.tenantId, pagination, actor.role);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  listMovements = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const pagination = parsePaginationQuery(req.query as any);
      const materialId = req.query.materialId as string | undefined;
      const type = req.query.type as string | undefined;
      const orderId = req.query.orderId as string | undefined;
      const result = await this.stockService.listMovements(actor.tenantId, pagination, {
        materialId,
        type,
        orderId,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  getStockSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const result = await this.stockService.getStockSummary(actor.tenantId, { role: actor.role });
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };
}
