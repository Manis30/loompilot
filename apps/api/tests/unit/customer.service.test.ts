import { describe, it, expect, beforeEach } from "vitest";
import { CustomerService } from "../../src/services/customer.service.js";
import {
  ICustomerRepository,
  Customer,
  NewCustomer,
} from "../../src/interfaces/customer.repository.js";
import { ListQuery, Page, toPage } from "../../src/utils/pagination.js";
import { Actor } from "../../src/utils/actor.js";
import { UserRole } from "@loompilot/shared";

class FakeCustomerRepository implements ICustomerRepository {
  private items: Customer[] = [];

  async create(data: NewCustomer): Promise<Customer> {
    const customer: Customer = {
      id: `cust_${Date.now()}_${Math.random()}`,
      tenantId: data.tenantId,
      name: data.name,
      code: data.code || `CUST-${this.items.length + 1}`,
      contactPerson: data.contactPerson,
      email: data.email,
      phone: data.phone,
      address: data.address,
      creditPeriodDays: data.creditPeriodDays ?? 30,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.items.push(customer);
    return customer;
  }

  async findById(tenantId: string, id: string): Promise<Customer | null> {
    return this.items.find((c) => c.tenantId === tenantId && c.id === id) || null;
  }

  async findByCode(tenantId: string, code: string): Promise<Customer | null> {
    return this.items.find((c) => c.tenantId === tenantId && c.code === code) || null;
  }

  async list(tenantId: string, query?: ListQuery): Promise<Page<Customer>> {
    const filtered = this.items.filter((c) => c.tenantId === tenantId);
    return toPage(filtered, filtered.length, query?.page || 1, query?.limit || 50);
  }

  async count(tenantId: string): Promise<number> {
    return this.items.filter((c) => c.tenantId === tenantId).length;
  }
}

describe("Unit: CustomerService", () => {
  let fakeRepo: FakeCustomerRepository;
  let service: CustomerService;
  const actor: Actor = {
    userId: "usr_1",
    email: "sales@loompilot.test",
    role: UserRole.SALES,
    tenantId: "tenant_123",
  };

  beforeEach(() => {
    fakeRepo = new FakeCustomerRepository();
    service = new CustomerService(fakeRepo);
  });

  it("creates a customer with sequential code when code is omitted", async () => {
    const customer = await service.create(actor, {
      name: "Acme Textiles",
      contactPerson: "Jane Doe",
      email: "jane@acme.test",
      phone: "+91 9988776655",
    });

    expect(customer.id).toBeDefined();
    expect(customer.code).toBe("CUST-001");
    expect(customer.name).toBe("Acme Textiles");
  });

  it("finds customer by ID or throws NotFoundError", async () => {
    const created = await service.create(actor, {
      name: "Fabrics R Us",
      contactPerson: "John Smith",
      email: "john@fabrics.test",
      phone: "+91 9988776644",
    });

    const found = await service.getById(actor, created.id);
    expect(found.name).toBe("Fabrics R Us");

    await expect(service.getById(actor, "unknown-id")).rejects.toThrow(/not found/i);
  });
});

