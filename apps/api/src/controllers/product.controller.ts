import { Request, Response, NextFunction } from "express";
import { ProductService } from "../services/product.service.js";
import { parsePaginationQuery } from "../utils/pagination.js";

export class ProductController {
  constructor(private readonly productService = new ProductService()) {}

  listProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const pagination = parsePaginationQuery(req.query as any);
      const search = req.query.search as string | undefined;

      const result = await this.productService.listProducts(actor.tenantId, pagination, search);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  getProductById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const product = await this.productService.getProductById(actor.tenantId, req.params.id as string);
      res.json({ data: product });
    } catch (err) {
      next(err);
    }
  };

  createProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const created = await this.productService.createProduct({
        tenantId: actor.tenantId,
        ...req.body,
        actor: {
          id: actor.subjectId,
          ip: req.ip,
          requestId: actor.requestId,
        },
      });
      res.status(201).json({ data: created });
    } catch (err) {
      next(err);
    }
  };

  updateProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const updated = await this.productService.updateProduct({
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
    } catch (err) {
      next(err);
    }
  };

  deleteProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      await this.productService.deleteProduct({
        tenantId: actor.tenantId,
        id: req.params.id as string,
        actor: {
          id: actor.subjectId,
          ip: req.ip,
          requestId: actor.requestId,
        },
      });
      res.json({ success: true, message: "Product deleted successfully" });
    } catch (err) {
      next(err);
    }
  };

  listClientCatalogue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const pagination = parsePaginationQuery(req.query as any);
      const result = await this.productService.listClientSafe(actor.tenantId, pagination);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  getClientCatalogueItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const product = await this.productService.getClientSafeById(actor.tenantId, req.params.id as string);
      res.json({ data: product });
    } catch (err) {
      next(err);
    }
  };

  addProductImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const fileId = req.body.fileId;
      const updated = await this.productService.addImage(actor.tenantId, req.params.id as string, fileId, {
        id: actor.subjectId,
      });
      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  };
}
