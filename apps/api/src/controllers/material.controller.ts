import { Request, Response } from "express";
import { MaterialService } from "../services/material.service.js";
import { parsePaginationQuery } from "../utils/pagination.js";

export class MaterialController {
  constructor(private readonly materialService = new MaterialService()) {}

  listMaterials = async (req: Request, res: Response): Promise<void> => {
    const actor = req.actor!;
    const pagination = parsePaginationQuery(req.query as any);
    const filterParams = {
      type: req.query.type as string | undefined,
      watchlist: req.query.watchlist !== undefined ? req.query.watchlist === "true" : undefined,
      search: req.query.search as string | undefined,
    };

    const result = await this.materialService.listMaterials(actor.tenantId, pagination, filterParams);
    res.json(result);
  };

  getMaterialById = async (req: Request, res: Response): Promise<void> => {
    const actor = req.actor!;
    const material = await this.materialService.getMaterialById(actor.tenantId, req.params.id as string);
    res.json({ data: material });
  };

  createMaterial = async (req: Request, res: Response): Promise<void> => {
    const actor = req.actor!;
    const created = await this.materialService.createMaterial({
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

  updateMaterial = async (req: Request, res: Response): Promise<void> => {
    const actor = req.actor!;
    const updated = await this.materialService.updateMaterial({
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

  updateRate = async (req: Request, res: Response): Promise<void> => {
    const actor = req.actor!;
    const currentRatePaise = Number(req.body.currentRatePaise);

    const updated = await this.materialService.updateRate({
      tenantId: actor.tenantId,
      id: req.params.id as string,
      currentRatePaise,
      actor: {
        id: actor.subjectId,
        ip: req.ip,
        requestId: actor.requestId,
      },
    });
    res.json({ data: updated });
  };

  updateSupplierOffers = async (req: Request, res: Response): Promise<void> => {
    const actor = req.actor!;
    const updated = await this.materialService.updateSupplierOffers({
      tenantId: actor.tenantId,
      id: req.params.id as string,
      offers: req.body.supplierOffers || [],
      actor: {
        id: actor.subjectId,
        ip: req.ip,
        requestId: actor.requestId,
      },
    });
    res.json({ data: updated });
  };

  deleteMaterial = async (req: Request, res: Response): Promise<void> => {
    const actor = req.actor!;
    await this.materialService.deleteMaterial({
      tenantId: actor.tenantId,
      id: req.params.id as string,
      actor: {
        id: actor.subjectId,
        ip: req.ip,
        requestId: actor.requestId,
      },
    });
    res.json({ success: true, message: "Material deleted successfully" });
  };
}
