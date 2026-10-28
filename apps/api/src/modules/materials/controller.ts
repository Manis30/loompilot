import { Request, Response } from "express";
import { MaterialService } from "./service.js";

export class MaterialController {
  static async list(req: Request, res: Response): Promise<void> {
    const materials = await MaterialService.list(req.user!.tenantId);
    res.json({ data: materials, requestId: req.requestId });
  }

  static async getById(req: Request, res: Response): Promise<void> {
    const material = await MaterialService.getById(req.user!.tenantId, req.params.id!);
    if (!material) {
      res.status(404).json({ error: "NotFound", message: "Material not found", requestId: req.requestId });
      return;
    }
    res.json({ data: material, requestId: req.requestId });
  }

  static async create(req: Request, res: Response): Promise<void> {
    const material = await MaterialService.create({
      ...req.body,
      tenantId: req.user!.tenantId,
    });
    res.status(201).json({ data: material, requestId: req.requestId });
  }

  static async recordMovement(req: Request, res: Response): Promise<void> {
    const movement = await MaterialService.recordMovement(
      req.user!.tenantId,
      req.params.id!,
      req.body.type,
      req.body.quantity,
      req.body.referenceType,
      req.body.referenceId,
      req.body.notes
    );
    res.status(201).json({ data: movement, requestId: req.requestId });
  }

  static async getMovements(req: Request, res: Response): Promise<void> {
    const movements = await MaterialService.getMovements(req.user!.tenantId, req.params.id!);
    res.json({ data: movements, requestId: req.requestId });
  }

  static async getPriceHistory(req: Request, res: Response): Promise<void> {
    const history = await MaterialService.getPriceHistory(req.user!.tenantId, req.params.id!);
    res.json({ data: history, requestId: req.requestId });
  }
}

