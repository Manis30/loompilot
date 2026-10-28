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
        userId: actor.userId,
        userRole: actor.role,
        action: "CUSTOMER_CREATED",
        entity: "customer",
        entityId: customer.id,
      });
    }

    return customer;
  }
}
