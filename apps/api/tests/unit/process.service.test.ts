import { describe, it, expect, beforeEach } from "vitest";
import { ProcessService } from "../../src/services/process.service.js";
import {
  IProcessRepository,
  Process,
  NewProcess,
} from "../../src/interfaces/process.repository.js";
import { ListQuery, Page, toPage } from "../../src/utils/pagination.js";
import { Actor } from "../../src/utils/actor.js";
import { ProcessName, UserRole } from "@loompilot/shared";
import { NotFoundError, ConflictError } from "../../src/errors/index.js";

class FakeProcessRepository implements IProcessRepository {
  private items: Process[] = [];

  async create(data: NewProcess): Promise<Process> {
    const processItem: Process = {
      id: `proc_${Date.now()}_${Math.random()}`,
      tenantId: data.tenantId,
      name: data.name,
      sequence: data.sequence,
      standardWastagePct: data.standardWastagePct ?? 2.0,
      avgOutputPerWorkerHour: data.avgOutputPerWorkerHour ?? 10,
      unit: data.unit ?? "meters",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.items.push(processItem);
    return processItem;
  }

  async findById(tenantId: string, id: string): Promise<Process | null> {
    return this.items.find((p) => p.tenantId === tenantId && p.id === id) || null;
  }

  async findByName(tenantId: string, name: ProcessName): Promise<Process | null> {
    return this.items.find((p) => p.tenantId === tenantId && p.name === name) || null;
  }

  async list(tenantId: string, query?: ListQuery): Promise<Page<Process>> {
    const filtered = this.items.filter((p) => p.tenantId === tenantId);
    return toPage(filtered, filtered.length, query?.page || 1, query?.limit || 50);
  }

  async listAllOrdered(tenantId: string): Promise<Process[]> {
    return this.items
      .filter((p) => p.tenantId === tenantId)
      .sort((a, b) => a.sequence - b.sequence);
  }
}

describe("Unit: ProcessService", () => {
  let fakeRepo: FakeProcessRepository;
  let service: ProcessService;
  const actor: Actor = {
    userId: "usr_owner",
    email: "owner@loompilot.test",
    role: UserRole.OWNER,
    tenantId: "tenant_proc_unit",
  };

  beforeEach(() => {
    fakeRepo = new FakeProcessRepository();
    service = new ProcessService(fakeRepo);
  });

  it("creates a process and enforces unique process name per tenant", async () => {
    const p1 = await service.create(actor, {
      name: ProcessName.WARPING,
      sequence: 1,
      standardWastagePct: 1.5,
      avgOutputPerWorkerHour: 25,
    });

    expect(p1.id).toBeDefined();
    expect(p1.name).toBe(ProcessName.WARPING);

    await expect(
      service.create(actor, {
        name: ProcessName.WARPING,
        sequence: 2,
      })
    ).rejects.toThrow(ConflictError);
  });

  it("retrieves process by ID or throws NotFoundError", async () => {
    const created = await service.create(actor, {
      name: ProcessName.WEAVING,
      sequence: 2,
    });

    const found = await service.getById(actor, created.id);
    expect(found.sequence).toBe(2);

    await expect(service.getById(actor, "unknown-id")).rejects.toThrow(NotFoundError);
  });
});
