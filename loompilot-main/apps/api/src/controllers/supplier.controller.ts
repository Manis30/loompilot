import { Request, Response } from "express";
import { SupplierService } from "../services/supplier.service.js";
import { parsePaginationQuery } from "../utils/pagination.js";

export class SupplierController {
  constructor(private readonly supplierService = new SupplierService()) {}

  listSuppliers = async (req: Request, res: Response): Promise<void> => {
    const actor = req.actor!;
    const pagination = parsePaginationQuery(req.query as any);
    const search = req.query.search as string | undefined;

    const result = await this.supplierService.listSuppliers(actor.tenantId, pagination, search);
    res.json(result);
  };

  getSupplierById = async (req: Request, res: Response): Promise<void> => {
    const actor = req.actor!;
    const supplier = await this.supplierService.getSupplierById(actor.tenantId, req.params.id as string);
    res.json({ data: supplier });
  };

  createSupplier = async (req: Request, res: Response): Promise<void> => {
    const actor = req.actor!;
    const created = await this.supplierService.createSupplier({
      tenantId: actor.tenantId,
      ...req.body,
      actor: {
        id: actor.subjectId,
        ip: req.ip,
        requestId: actor.requestId,
      },
    });
    res.status(201).json({ data: created });
  };

  updateSupplier = async (req: Request, res: Response): Promise<void> => {
    const actor = req.actor!;
    const updated = await this.supplierService.updateSupplier({
      tenantId: actor.tenantId,
      id: req.params.id as string,
      updates: req.body,
      actor: {
        id: actor.subjectId,
        ip: req.ip,
        requestId: actor.requestId,
      },
    });
    res.json({ data: updated });
  };

  deleteSupplier = async (req: Request, res: Response): Promise<void> => {
    const actor = req.actor!;
    await this.supplierService.deactivateSupplier({
      tenantId: actor.tenantId,
      id: req.params.id as string,
      actor: {
        id: actor.subjectId,
        ip: req.ip,
        requestId: actor.requestId,
      },
    });
    res.json({ success: true, message: "Supplier deactivated successfully" });
  };
}
