import { describe, it, expect, beforeEach } from "vitest";
import { SupplierService } from "../../src/services/supplier.service.js";
import {
  ISupplierRepository,
  Supplier,
  NewSupplier,
} from "../../src/interfaces/supplier.repository.js";
import { ListQuery, Page, toPage } from "../../src/utils/pagination.js";
import { Actor } from "../../src/utils/actor.js";
import { UserRole } from "@loompilot/shared";
import { NotFoundError } from "../../src/errors/index.js";

class FakeSupplierRepository implements ISupplierRepository {
  private suppliers: Supplier[] = [];

  async create(data: NewSupplier): Promise<Supplier> {
    const supplier: Supplier = {
      id: `sup_${Date.now()}_${Math.random()}`,
      tenantId: data.tenantId,
      name: data.name,
      contactPerson: data.contactPerson,
      email: data.email,
      phone: data.phone,
      leadTimeDays: data.leadTimeDays ?? 7,
      rating: data.rating ?? 4.5,
      suppliedMaterials: data.suppliedMaterials ?? [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.suppliers.push(supplier);
    return supplier;
  }

  async findById(tenantId: string, id: string): Promise<Supplier | null> {
    return this.suppliers.find((s) => s.tenantId === tenantId && s.id === id) || null;
  }

  async list(tenantId: string, query?: ListQuery): Promise<Page<Supplier>> {
    const filtered = this.suppliers.filter((s) => s.tenantId === tenantId);
    return toPage(filtered, filtered.length, query?.page || 1, query?.limit || 50);
  }
}

describe("Unit: SupplierService", () => {
  let fakeRepo: FakeSupplierRepository;
  let service: SupplierService;
  const actor: Actor = {
    userId: "usr_store",
    email: "store@loompilot.test",
    role: UserRole.STORE,
    tenantId: "tenant_sup_unit",
  };

  beforeEach(() => {
    fakeRepo = new FakeSupplierRepository();
    service = new SupplierService(fakeRepo);
  });

  it("creates a supplier with default lead time and rating", async () => {
    const supplier = await service.create(actor, {
      name: "Lakshmi Yarns",
      contactPerson: "R. Sharma",
      email: "sharma@lakshmi.test",
      phone: "+91 9876543210",
    });

    expect(supplier.id).toBeDefined();
    expect(supplier.name).toBe("Lakshmi Yarns");
    expect(supplier.leadTimeDays).toBe(7);
    expect(supplier.rating).toBe(4.5);
  });

  it("retrieves supplier by ID or throws NotFoundError", async () => {
    const created = await service.create(actor, {
      name: "Apex Dyes & Chemicals",
      contactPerson: "V. Kumar",
      email: "kumar@apexdyes.test",
      phone: "+91 9876543211",
      leadTimeDays: 14,
    });

    const found = await service.getById(actor, created.id);
    expect(found.leadTimeDays).toBe(14);

    await expect(service.getById(actor, "unknown-id")).rejects.toThrow(NotFoundError);
  });
});

