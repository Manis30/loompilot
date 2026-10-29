import { ISupplierRepository, Supplier } from "../interfaces/supplier.repository.js";
import { IAuditLogRepository } from "../interfaces/audit-log.js";
import { Actor } from "../utils/actor.js";
import { ListQuery, Page } from "../utils/pagination.js";
import { CreateSupplierInput } from "../validators/supplier.validator.js";
import { NotFoundError } from "../errors/index.js";

export class SupplierService {
  constructor(
    private readonly repo: ISupplierRepository,
    private readonly audit?: IAuditLogRepository
  ) {}

  async list(actor: Actor, query?: ListQuery): Promise<Page<Supplier>> {
    return this.repo.list(actor.tenantId, query);
  }

  async getById(actor: Actor, id: string): Promise<Supplier> {
    const supplier = await this.repo.findById(actor.tenantId, id);
    if (!supplier) {
      throw new NotFoundError(`Supplier with ID ${id} not found`);
    }
    return supplier;
  }

  async create(actor: Actor, input: CreateSupplierInput): Promise<Supplier> {
    const supplier = await this.repo.create({
      tenantId: actor.tenantId,
      name: input.name,
      contactPerson: input.contactPerson,
      email: input.email,
      phone: input.phone,
      leadTimeDays: input.leadTimeDays,
      rating: input.rating,
      suppliedMaterials: input.suppliedMaterials,
    });

    if (this.audit) {
      await this.audit.record({
        tenantId: actor.tenantId,
        actorId: actor.userId,
        actorRole: actor.role,
        action: "SUPPLIER_CREATED",
        entityType: "supplier",
        entityId: supplier.id,
        after: { name: supplier.name },
      });
    }

    return supplier;
  }

  async update(
    actor: Actor,
    id: string,
    updates: Partial<Supplier>
  ): Promise<Supplier> {
    const existing = await this.repo.findById(actor.tenantId, id);
    if (!existing) {
      throw new NotFoundError(`Supplier with ID ${id} not found`);
    }

    const before = {
      name: existing.name,
      contactPerson: existing.contactPerson,
      email: existing.email,
      phone: existing.phone,
      leadTimeDays: existing.leadTimeDays,
      rating: existing.rating,
      active: existing.active,
    };

    const updated = await this.repo.update(actor.tenantId, id, updates);
    if (!updated) {
      throw new NotFoundError(`Supplier with ID ${id} not found`);
    }

    if (this.audit) {
      await this.audit.record({
        tenantId: actor.tenantId,
        actorId: actor.userId,
        actorRole: actor.role,
        action: updates.active === false ? "SUPPLIER_DEACTIVATED" : "SUPPLIER_UPDATED",
        entityType: "supplier",
        entityId: id,
        before,
        after: {
          name: updated.name,
          contactPerson: updated.contactPerson,
          email: updated.email,
          phone: updated.phone,
          leadTimeDays: updated.leadTimeDays,
          rating: updated.rating,
          active: updated.active,
        },
      });
    }

    return updated;
  }
}

