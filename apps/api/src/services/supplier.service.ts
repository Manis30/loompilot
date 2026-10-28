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
        userId: actor.userId,
        userRole: actor.role,
        action: "SUPPLIER_CREATED",
        entity: "supplier",
        entityId: supplier.id,
        changes: { name: supplier.name },
      });
    }

    return supplier;
  }
}
