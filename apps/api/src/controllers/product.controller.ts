import { Request, Response } from "express";
import { ProductService } from "../services/product.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Actor } from "../utils/actor.js";

export class ProductController {
  constructor(private readonly service: ProductService) {}

  private getActor(req: Request): Actor {
    return {
      tenantId: req.user!.tenantId,
      userId: req.user!.userId,
      role: req.user!.role,
      email: req.user!.email,
    };
  }

  list = asyncHandler(async (req: Request, res: Response) => {
    const actor = this.getActor(req);
    const filter = {
      activeOnly: req.query.active === "true",
      category: req.query.category as string | undefined,
    };
    const products = await this.service.list(actor, filter);
    res.json({
      data: products,
      requestId: req.requestId,
    });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const actor = this.getActor(req);
    const product = await this.service.getById(actor, req.params.id as string);
    res.json({
      data: product,
      requestId: req.requestId,
    });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const actor = this.getActor(req);
    const product = await this.service.create(actor, req.body);
    res.status(201).json({
      data: product,
      requestId: req.requestId,
    });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const actor = this.getActor(req);
    const updated = await this.service.update(
      actor,
      req.params.id as string,
      req.body
    );
    res.json({
      data: updated,
      requestId: req.requestId,
    });
  });

  getActiveBom = asyncHandler(async (req: Request, res: Response) => {
    const actor = this.getActor(req);
    const bom = await this.service.getActiveBom(actor, req.params.id as string);
    res.json({
      data: bom,
      requestId: req.requestId,
    });
  });

  listBoms = asyncHandler(async (req: Request, res: Response) => {
    const actor = this.getActor(req);
    const boms = await this.service.listBoms(actor, req.params.id as string);
    res.json({
      data: boms,
      requestId: req.requestId,
    });
  });

  createBom = asyncHandler(async (req: Request, res: Response) => {
    const actor = this.getActor(req);
    const bom = await this.service.createBomVersion(
      actor,
      req.params.id as string,
      req.body
    );
    res.status(201).json({
      data: bom,
      requestId: req.requestId,
    });
  });
}
