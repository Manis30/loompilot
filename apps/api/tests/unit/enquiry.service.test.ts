import { describe, it, expect, beforeEach } from "vitest";
import { EnquiryService } from "../../src/services/enquiry.service.js";
import {
  IEnquiryRepository,
  Enquiry,
  NewEnquiry,
} from "../../src/interfaces/enquiry.repository.js";
import { ListQuery, Page, toPage } from "../../src/utils/pagination.js";
import { Actor } from "../../src/utils/actor.js";
import { UserRole } from "@loompilot/shared";

class FakeEnquiryRepository implements IEnquiryRepository {
  private items: Enquiry[] = [];

  async create(data: NewEnquiry): Promise<Enquiry> {
    const enquiry: Enquiry = {
      id: `enq_${Date.now()}_${Math.random()}`,
      tenantId: data.tenantId,
      enquiryNumber: data.enquiryNumber || `ENQ-${this.items.length + 1}`,
      customerId: data.customerId,
      customerName: data.customerName,
      rawText: data.rawText,
      parsedRequirements: data.parsedRequirements,
      status: data.status || "new",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.items.push(enquiry);
    return enquiry;
  }

  async findById(tenantId: string, id: string): Promise<Enquiry | null> {
    return this.items.find((e) => e.tenantId === tenantId && e.id === id) || null;
  }

  async findByNumber(tenantId: string, enquiryNumber: string): Promise<Enquiry | null> {
    return this.items.find((e) => e.tenantId === tenantId && e.enquiryNumber === enquiryNumber) || null;
  }

  async list(tenantId: string, query?: ListQuery): Promise<Page<Enquiry>> {
    const filtered = this.items.filter((e) => e.tenantId === tenantId);
    return toPage(filtered, filtered.length, query?.page || 1, query?.limit || 50);
  }

  async count(tenantId: string): Promise<number> {
    return this.items.filter((e) => e.tenantId === tenantId).length;
  }

  async updateStatus(
    tenantId: string,
    id: string,
    status: Enquiry["status"]
  ): Promise<Enquiry | null> {
    const item = await this.findById(tenantId, id);
    if (!item) return null;
    item.status = status;
    return item;
  }
}

describe("Unit: EnquiryService", () => {
  let fakeRepo: FakeEnquiryRepository;
  let service: EnquiryService;
  const actor: Actor = {
    userId: "usr_1",
    email: "sales@loompilot.test",
    role: UserRole.SALES,
    tenantId: "tenant_123",
  };

  beforeEach(() => {
    fakeRepo = new FakeEnquiryRepository();
    service = new EnquiryService(fakeRepo);
  });

  it("creates an enquiry with sequential enquiry number", async () => {
    const result = await service.create(actor, {
      customerId: "cust_1",
      customerName: "Silk Mill Co",
      rawText: "Need 500m of dyed cotton fabric",
    });

    expect(result.id).toBeDefined();
    expect(result.enquiryNumber).toBe("ENQ-00001");
    expect(result.status).toBe("new");
    expect(result.customerName).toBe("Silk Mill Co");
  });

  it("retrieves an enquiry by id or throws NotFoundError", async () => {
    const created = await service.create(actor, {
      customerId: "cust_1",
      customerName: "Silk Mill Co",
      rawText: "Need fabric",
    });

    const retrieved = await service.getById(actor, created.id);
    expect(retrieved.id).toBe(created.id);

    await expect(service.getById(actor, "nonexistent")).rejects.toThrow(/not found/i);
  });
});
