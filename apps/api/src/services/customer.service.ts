import { ICustomerRepository, Customer } from "../interfaces/customer.repository.js";
import { IAuditLogRepository } from "../interfaces/audit-log.js";
import { Actor } from "../utils/actor.js";
import { ListQuery, Page } from "../utils/pagination.js";
import { CreateCustomerInput } from "../validators/customer.validator.js";
import { NotFoundError } from "../errors/index.js";

export class CustomerService {
  constructor(
    private readonly customers: ICustomerRepository,
    private readonly audit?: IAuditLogRepository
  ) {}

  async list(actor: Actor, query?: ListQuery): Promise<Page<Customer>> {
    return this.customers.list(actor.tenantId, query);
  }

  async getById(actor: Actor, id: string): Promise<Customer> {
    const customer = await this.customers.findById(actor.tenantId, id);
    if (!customer) {
      throw new NotFoundError(`Customer with ID ${id} not found`);
    }
    return customer;
  }

  async create(actor: Actor, input: CreateCustomerInput): Promise<Customer> {
    const count = await this.customers.count(actor.tenantId);
    const code = input.code || `CUST-${String(count + 1).padStart(3, "0")}`;

    const customer = await this.customers.create({
      tenantId: actor.tenantId,
      name: input.name,
      code,
      contactPerson: input.contactPerson,
      email: input.email,
      phone: input.phone,
      address: input.address,
      creditPeriodDays: input.creditPeriodDays ?? 30,
    });

    if (this.audit) {
      await this.audit.record({
        tenantId: actor.tenantId,
        actorId: actor.userId,
        actorRole: actor.role,
        action: "CUSTOMER_CREATED",
        entityType: "customer",
        entityId: customer.id,
        after: { code: customer.code, name: customer.name },
      });
    }

    return customer;
  }

  async update(
    actor: Actor,
    id: string,
    updates: Partial<Customer>
  ): Promise<Customer> {
    const existing = await this.customers.findById(actor.tenantId, id);
    if (!existing) {
      throw new NotFoundError(`Customer with ID ${id} not found`);
    }

    const before = {
      name: existing.name,
      contactPerson: existing.contactPerson,
      email: existing.email,
      phone: existing.phone,
      address: existing.address,
      creditPeriodDays: existing.creditPeriodDays,
      gstin: existing.gstin,
      preferredChannel: existing.preferredChannel,
      notes: existing.notes,
      active: existing.active,
    };

    const updated = await this.customers.update(actor.tenantId, id, updates);
    if (!updated) {
      throw new NotFoundError(`Customer with ID ${id} not found`);
    }

    if (this.audit) {
      await this.audit.record({
        tenantId: actor.tenantId,
        actorId: actor.userId,
        actorRole: actor.role,
        action: updates.active === false ? "CUSTOMER_DEACTIVATED" : "CUSTOMER_UPDATED",
        entityType: "customer",
        entityId: id,
        before,
        after: {
          name: updated.name,
          contactPerson: updated.contactPerson,
          email: updated.email,
          phone: updated.phone,
          active: updated.active,
        },
      });
    }

    return updated;
  }
}

