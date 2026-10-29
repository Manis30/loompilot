import {
  IProductRepository,
  Product,
  Bom,
} from "../interfaces/product.repository.js";
import { IAuditLogRepository } from "../interfaces/audit-log.js";
import { Actor } from "../utils/actor.js";
import {
  CreateProductInput,
  UpdateProductInput,
  CreateBomInput,
} from "../validators/product.validator.js";
import { NotFoundError, ConflictError } from "../errors/index.js";

export class ProductService {
  constructor(
    private readonly repo: IProductRepository,
    private readonly audit?: IAuditLogRepository
  ) {}

  async list(
    actor: Actor,
    filter?: { activeOnly?: boolean; category?: string }
  ): Promise<Product[]> {
    return this.repo.list(actor.tenantId, filter);
  }

  async getById(actor: Actor, id: string): Promise<Product> {
    const product = await this.repo.findById(actor.tenantId, id);
    if (!product) throw new NotFoundError("Product not found");
    return product;
  }

  async create(actor: Actor, input: CreateProductInput): Promise<Product> {
    const existing = await this.repo.findByCode(actor.tenantId, input.code);
    if (existing) {
      throw new ConflictError(`Product with code '${input.code}' already exists`);
    }

    const product = await this.repo.create({
      tenantId: actor.tenantId,
      code: input.code,
      name: input.name,
      description: input.description,
      unit: input.unit,
      category: input.category,
      active: input.active ?? true,
    });

    if (this.audit) {
      await this.audit.record({
        tenantId: actor.tenantId,
        actorId: actor.userId,
        actorRole: actor.role,
        action: "PRODUCT_CREATED",
        entityType: "product",
        entityId: product.id,
        after: { code: product.code, name: product.name },
      });
    }

    return product;
  }

  async update(
    actor: Actor,
    id: string,
    input: UpdateProductInput
  ): Promise<Product> {
    const existing = await this.repo.findById(actor.tenantId, id);
    if (!existing) throw new NotFoundError("Product not found");

    const before = {
      name: existing.name,
      description: existing.description,
      unit: existing.unit,
      category: existing.category,
      active: existing.active,
    };

    const updated = await this.repo.update(actor.tenantId, id, input);
    if (!updated) throw new NotFoundError("Product not found");

    if (this.audit) {
      await this.audit.record({
        tenantId: actor.tenantId,
        actorId: actor.userId,
        actorRole: actor.role,
        action: "PRODUCT_UPDATED",
        entityType: "product",
        entityId: id,
        before,
        after: {
          name: updated.name,
          description: updated.description,
          unit: updated.unit,
          category: updated.category,
          active: updated.active,
        },
      });
    }

    return updated;
  }

  async getActiveBom(actor: Actor, productId: string): Promise<Bom | null> {
    await this.getById(actor, productId);
    return this.repo.getActiveBom(actor.tenantId, productId);
  }

  async listBoms(actor: Actor, productId: string): Promise<Bom[]> {
    await this.getById(actor, productId);
    return this.repo.listBoms(actor.tenantId, productId);
  }

  async createBomVersion(
    actor: Actor,
    productId: string,
    input: CreateBomInput
  ): Promise<Bom> {
    await this.getById(actor, productId);

    const rawItems = input.items || input.materials || [];
    const items = rawItems.map((i) => ({
      materialId: i.materialId,
      quantityPerUnit: i.quantityPerUnit ?? i.quantity ?? 1,
      unit: i.unit,
      wastageAllowancePct: i.wastageAllowancePct ?? i.wastagePercent ?? 0,
    }));

    const effectiveFromDate = input.effectiveFrom
      ? new Date(input.effectiveFrom)
      : input.effectiveDate
      ? new Date(input.effectiveDate)
      : undefined;

    const bom = await this.repo.createBomVersion({
      tenantId: actor.tenantId,
      productId,
      items,
      effectiveFrom: effectiveFromDate,
    });

    if (this.audit) {
      await this.audit.record({
        tenantId: actor.tenantId,
        actorId: actor.userId,
        actorRole: actor.role,
        action: "BOM_VERSION_CREATED",
        entityType: "bom",
        entityId: bom.id,
        after: {
          productId,
          version: bom.version,
          itemCount: bom.items.length,
        },
      });
    }

    return bom;
  }
}
