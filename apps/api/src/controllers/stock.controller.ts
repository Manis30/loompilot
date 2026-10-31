import { Request, Response } from "express";
import { StockService } from "../services/stock.service.js";
import { parsePaginationQuery } from "../utils/pagination.js";

export class StockController {
  constructor(private readonly stockService = new StockService()) {}

  recordGoodsReceipt = async (req: Request, res: Response): Promise<void> => {
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
  };

  adjustStock = async (req: Request, res: Response): Promise<void> => {
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
  };

  getStockBalances = async (req: Request, res: Response): Promise<void> => {
    const actor = req.actor!;
    const pagination = parsePaginationQuery(req.query as any);
    const result = await this.stockService.getStockBalances(actor.tenantId, pagination);
    res.json(result);
  };

  listMovements = async (req: Request, res: Response): Promise<void> => {
    const actor = req.actor!;
    const pagination = parsePaginationQuery(req.query as any);
    const materialId = req.query.materialId as string | undefined;
    const result = await this.stockService.listMovements(actor.tenantId, pagination, materialId);
    res.json(result);
  };
}
