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
      const category = req.query.category as string | undefined;

      let active: boolean | undefined = undefined;
      if (typeof req.query.active === "boolean") {
        active = req.query.active;
      } else if (req.query.status === "active") {
        active = true;
      } else if (req.query.status === "inactive") {
        active = false;
      }

      const result = await this.productService.listProducts(actor.tenantId, pagination, {
        search,
        category,
        active,
      });
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
        productName: req.body.productName,
        category: req.body.category,
        basePricePaise: req.body.basePricePaise,
        bom: req.body.bom,
        routing: req.body.routing,
        imageFileIds: req.body.imageFileIds,
        active: req.body.active,
        actor: {
          id: actor.subjectId,
          email: actor.email,
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
        updates: {
          productName: req.body.productName,
          category: req.body.category,
          basePricePaise: req.body.basePricePaise,
          bom: req.body.bom,
          routing: req.body.routing,
          imageFileIds: req.body.imageFileIds,
          active: req.body.active,
        },
        actor: {
          id: actor.subjectId,
          email: actor.email,
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
          email: actor.email,
          ip: req.ip,
          requestId: actor.requestId,
        },
      });
      res.json({ success: true, message: "Product deactivated successfully" });
    } catch (err) {
      next(err);
    }
  };

  listClientCatalogue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const pagination = parsePaginationQuery(req.query as any);
      const search = req.query.search as string | undefined;
      const category = req.query.category as string | undefined;

      const result = await this.productService.listClientSafe(actor.tenantId, pagination, {
        search,
        category,
      });
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
        email: actor.email,
        ip: req.ip,
        requestId: actor.requestId,
      });
      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  };
}
