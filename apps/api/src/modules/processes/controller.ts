import { Request, Response } from "express";
import { ProcessService } from "./service.js";

export class ProcessController {
  static async list(req: Request, res: Response): Promise<void> {
    const processes = await ProcessService.list(req.user!.tenantId);
    res.json({ data: processes, requestId: req.requestId });
  }

  static async getById(req: Request, res: Response): Promise<void> {
    const processItem = await ProcessService.getById(req.user!.tenantId, req.params.id!);
    if (!processItem) {
      res.status(404).json({ error: "NotFound", message: "Process not found", requestId: req.requestId });
      return;
    }
    res.json({ data: processItem, requestId: req.requestId });
  }

  static async create(req: Request, res: Response): Promise<void> {
    const processItem = await ProcessService.create({
      ...req.body,
      tenantId: req.user!.tenantId,
    });
    res.status(201).json({ data: processItem, requestId: req.requestId });
  }
}

