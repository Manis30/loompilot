import { ProductRepository } from "../repositories/product.repository.js";
import { MaterialRepository } from "../repositories/material.repository.js";
import { SettingsRepository } from "../repositories/settings.repository.js";
import { FileRepository } from "../repositories/file.repository.js";
import { OrdersRepository } from "../repositories/orders.repository.js";
import { IProduct, IRoutingStep } from "../models/catalog/product.model.js";
import { PaginationQuery, PaginatedResult } from "../utils/pagination.js";
import { AuditService } from "./audit.service.js";
import { AppError } from "../errors/app-error.js";
import { ErrorCode } from "@loompilot/shared";

export interface ClientSafeProductDto {
  id: string;
  productName: string;
  category: string;
  basePricePaise: number;
  imageFileIds?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export function toClientSafeProductDto(product: any): ClientSafeProductDto {
  return {
    id: String(product._id || product.id),
    productName: product.productName,
    category: product.category,
    basePricePaise: product.basePricePaise,
    imageFileIds: product.imageFileIds?.map(String) || [],
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

export class ProductService {
  constructor(
    private readonly productRepo = new ProductRepository(),
    private readonly materialRepo = new MaterialRepository(),
    private readonly settingsRepo = new SettingsRepository(),
    private readonly auditService = new AuditService(),
    private readonly fileRepo = new FileRepository(),
    private readonly ordersRepo = new OrdersRepository()
  ) {}

  private async validateImages(tenantId: string, imageFileIds?: string[]): Promise<void> {
    if (!imageFileIds || imageFileIds.length === 0) {
      return;
    }

    for (const fileId of imageFileIds) {
      const file = await this.fileRepo.findById(tenantId, fileId);
      if (!file) {
        throw new AppError(ErrorCode.NOT_FOUND, `Image file '${fileId}' not found`, 404);
      }
      if (!file.mime.startsWith("image/")) {
        throw new AppError(
          ErrorCode.VALIDATION_FAILED,
          `File '${fileId}' is not an image (mime: '${file.mime}')`,
          400
        );
      }
    }
  }

  private async validateBom(
    tenantId: string,
    bom: Array<{ materialId: string; qtyPerUnit: number; wastage?: number }>
  ): Promise<Array<{ materialId: string; qtyPerUnit: number; wastage?: number }>> {
    if (!bom || bom.length === 0) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, "Product BOM must contain at least one material line", 400);
    }

    const seenMaterials = new Set<string>();
    const validated: Array<{ materialId: string; qtyPerUnit: number; wastage?: number }> = [];

    for (const item of bom) {
      if (seenMaterials.has(item.materialId)) {
        throw new AppError(ErrorCode.VALIDATION_FAILED, `Duplicate material '${item.materialId}' in BOM`, 400);
      }
      seenMaterials.add(item.materialId);

      const material = await this.materialRepo.findById(tenantId, item.materialId);
      if (!material) {
        throw new AppError(ErrorCode.VALIDATION_FAILED, `Material '${item.materialId}' does not exist`, 400);
      }
      if (material.status === "inactive") {
        throw new AppError(ErrorCode.VALIDATION_FAILED, `Material '${item.materialId}' is inactive and cannot be selected`, 400);
      }

      if (item.qtyPerUnit <= 0) {
        throw new AppError(ErrorCode.VALIDATION_FAILED, `BOM qtyPerUnit must be positive`, 400);
      }

      validated.push({
        materialId: item.materialId,
        qtyPerUnit: item.qtyPerUnit,
        wastage: item.wastage ?? 0,
      });
    }

    return validated;
  }

  private async validateRouting(
    tenantId: string,
    routing: Array<{ stage: string; seq: number; stdMinPerUnit: number }>
  ): Promise<IRoutingStep[]> {
    if (!routing || routing.length === 0) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, "Product routing must contain at least one stage", 400);
    }

    const settings = await this.settingsRepo.getSettings(tenantId);
    const validAreas = settings?.processConfig
      ? new Set(settings.processConfig.map((p) => p.area.toLowerCase()))
      : null;

    const seenSeq = new Set<number>();
    const validated: IRoutingStep[] = [];

    for (const step of routing) {
      if (seenSeq.has(step.seq)) {
        throw new AppError(ErrorCode.VALIDATION_FAILED, `Duplicate sequence number ${step.seq} in routing`, 400);
      }
      seenSeq.add(step.seq);

      if (validAreas && !validAreas.has(step.stage.toLowerCase())) {
        throw new AppError(
          ErrorCode.VALIDATION_FAILED,
          `Routing stage '${step.stage}' is not configured in tenant processConfig. Allowed: [${Array.from(validAreas).join(", ")}]`,
          400
        );
      }

      if (step.stdMinPerUnit <= 0) {
        throw new AppError(ErrorCode.VALIDATION_FAILED, "Routing stdMinPerUnit must be positive", 400);
      }

      validated.push({
        stage: step.stage,
        seq: step.seq,
        stdMinPerUnit: step.stdMinPerUnit,
      });
    }

    // Sort by sequence
    validated.sort((a, b) => a.seq - b.seq);
    return validated;
  }

  async listProducts(
    tenantId: string,
    pagination: PaginationQuery,
    filterOptions?: {
      search?: string;
      category?: string;
      active?: boolean;
    }
  ): Promise<PaginatedResult<IProduct>> {
    const filter: Record<string, any> = {};
    if (filterOptions?.search) {
      const searchRegex = { $regex: filterOptions.search.trim(), $options: "i" };
      filter.$or = [
        { productName: searchRegex },
        { category: searchRegex },
      ];
    }
    if (filterOptions?.category) {
      filter.category = { $regex: `^${filterOptions.category.trim()}$`, $options: "i" };
    }
    if (typeof filterOptions?.active === "boolean") {
      filter.active = filterOptions.active;
    }
    return this.productRepo.findPaginated(tenantId, filter, pagination);
  }

  async getProductById(tenantId: string, id: string): Promise<IProduct> {
    const product = await this.productRepo.findById(tenantId, id);
    if (!product) {
      throw new AppError(ErrorCode.NOT_FOUND, `Product with id '${id}' not found`, 404);
    }
    return product;
  }

  async createProduct(params: {
    tenantId: string;
    productName: string;
    category: string;
    basePricePaise: number;
    bom: Array<{ materialId: string; qtyPerUnit: number; wastage?: number }>;
    routing: Array<{ stage: string; seq: number; stdMinPerUnit: number }>;
    imageFileIds?: string[];
    active?: boolean;
    actor: { id: string; email?: string; ip?: string; requestId?: string };
  }): Promise<IProduct> {
    const { tenantId, actor, ...data } = params;

    const validatedBom = await this.validateBom(tenantId, data.bom);
    const validatedRouting = await this.validateRouting(tenantId, data.routing);
    if (data.imageFileIds && data.imageFileIds.length > 0) {
      await this.validateImages(tenantId, data.imageFileIds);
    }

    const created = await this.productRepo.createProductWithDetails(tenantId, {
      productName: data.productName,
      category: data.category,
      basePricePaise: data.basePricePaise,
      bom: validatedBom,
      routing: validatedRouting,
      imageFileIds: data.imageFileIds,
      active: data.active ?? true,
    });

    await this.auditService.log({
      tenantId,
      actor: { id: actor.id, type: "user", email: actor.email },
      action: "PRODUCT_CREATED",
      entity: { collection: "products", id: String(created._id) },
      after: { productName: created.productName, basePricePaise: created.basePricePaise },
      ip: actor.ip,
      requestId: actor.requestId,
    });

    return created;
  }

  async updateProduct(params: {
    tenantId: string;
    id: string;
    updates: {
      productName?: string;
      category?: string;
      basePricePaise?: number;
      bom?: Array<{ materialId: string; qtyPerUnit: number; wastage?: number }>;
      routing?: Array<{ stage: string; seq: number; stdMinPerUnit: number }>;
      imageFileIds?: string[];
      active?: boolean;
    };
    actor: { id: string; email?: string; ip?: string; requestId?: string };
  }): Promise<IProduct> {
    const { tenantId, id, updates, actor } = params;
    const before = await this.getProductById(tenantId, id);

    const payload: {
      productName?: string;
      category?: string;
      basePricePaise?: number;
      bom?: Array<{ materialId: string; qtyPerUnit: number; wastage?: number }>;
      routing?: IRoutingStep[];
      imageFileIds?: string[];
      active?: boolean;
    } = {};

    if (updates.productName !== undefined) {
      payload.productName = updates.productName;
    }
    if (updates.category !== undefined) {
      payload.category = updates.category;
    }
    if (updates.basePricePaise !== undefined) {
      payload.basePricePaise = updates.basePricePaise;
    }
    if (updates.bom !== undefined) {
      payload.bom = await this.validateBom(tenantId, updates.bom);
    }
    if (updates.routing !== undefined) {
      payload.routing = await this.validateRouting(tenantId, updates.routing);
    }
    if (updates.imageFileIds !== undefined) {
      await this.validateImages(tenantId, updates.imageFileIds);
      payload.imageFileIds = updates.imageFileIds;
    }
    if (updates.active !== undefined) {
      payload.active = updates.active;
    }

    const updated = await this.productRepo.updateProductWithDetails(tenantId, id, payload);
    if (!updated) {
      throw new AppError(ErrorCode.NOT_FOUND, `Product '${id}' not found`, 404);
    }

    await this.auditService.log({
      tenantId,
      actor: { id: actor.id, type: "user", email: actor.email },
      action: "PRODUCT_UPDATED",
      entity: { collection: "products", id },
      before,
      after: updated,
      ip: actor.ip,
      requestId: actor.requestId,
    });

    return updated;
  }

  async deleteProduct(params: {
    tenantId: string;
    id: string;
    actor: { id: string; email?: string; ip?: string; requestId?: string };
  }): Promise<void> {
    const { tenantId, id, actor } = params;
    const before = await this.getProductById(tenantId, id);

    const historicalOrderCount = await this.ordersRepo.countByProductId(tenantId, id);

    await this.productRepo.updateProductWithDetails(tenantId, id, { active: false });

    await this.auditService.log({
      tenantId,
      actor: { id: actor.id, type: "user", email: actor.email },
      action: "PRODUCT_DEACTIVATED",
      entity: { collection: "products", id },
      before,
      after: { active: false, historicalOrderCount },
      ip: actor.ip,
      requestId: actor.requestId,
    });
  }

  async listClientSafe(
    tenantId: string,
    pagination: PaginationQuery,
    filterOptions?: { search?: string; category?: string }
  ): Promise<PaginatedResult<ClientSafeProductDto>> {
    const result = await this.productRepo.findClientSafePaginated(tenantId, pagination, filterOptions);
    return {
      data: result.data.map(toClientSafeProductDto),
      meta: result.meta,
    };
  }

  async getClientSafeById(tenantId: string, id: string): Promise<ClientSafeProductDto> {
    const product = await this.productRepo.findClientSafeById(tenantId, id);
    if (!product) {
      throw new AppError(ErrorCode.NOT_FOUND, `Product '${id}' not found in active catalogue`, 404);
    }
    return toClientSafeProductDto(product);
  }

  async addImage(
    tenantId: string,
    productId: string,
    fileId: string,
    actor: { id: string; email?: string; ip?: string; requestId?: string }
  ): Promise<IProduct> {
    await this.getProductById(tenantId, productId);
    await this.validateImages(tenantId, [fileId]);

    const updated = await this.productRepo.addImageFileId(tenantId, productId, fileId);
    if (!updated) {
      throw new AppError(ErrorCode.NOT_FOUND, `Product '${productId}' not found`, 404);
    }

    await this.auditService.log({
      tenantId,
      actor: { id: actor.id, type: "user", email: actor.email },
      action: "PRODUCT_IMAGE_ADDED",
      entity: { collection: "products", id: productId },
      after: { fileId },
      ip: actor.ip,
      requestId: actor.requestId,
    });

    return updated;
  }
}

