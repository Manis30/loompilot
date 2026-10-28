import { Request, Response } from "express";
import { SupplierService } from "./service.js";

export class SupplierController {
  static async list(req: Request, res: Response): Promise<void> {
    const suppliers = await SupplierService.list(req.user!.tenantId);
    res.json({ data: suppliers, requestId: req.requestId });
  }

  static async getById(req: Request, res: Response): Promise<void> {
    const supplier = await SupplierService.getById(req.user!.tenantId, req.params.id!);
    if (!supplier) {
      res.status(404).json({ error: "NotFound", message: "Supplier not found", requestId: req.requestId });
      return;
    }
    res.json({ data: supplier, requestId: req.requestId });
  }

  static async create(req: Request, res: Response): Promise<void> {
    const supplier = await SupplierService.create({
      ...req.body,
      tenantId: req.user!.tenantId,
    });
    res.status(201).json({ data: supplier, requestId: req.requestId });
  }
}

