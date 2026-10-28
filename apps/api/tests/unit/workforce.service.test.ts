import { describe, it, expect, beforeEach, vi } from "vitest";
import { WorkforceService } from "../../src/services/workforce.service.js";
import {
  IWorkforceRepository,
  Worker,
  NewWorker,
  AttendanceRecord,
  AttendanceItem,
  DailyOutput,
  NewDailyOutput,
} from "../../src/interfaces/workforce.repository.js";
import { FakeUnitOfWork } from "../../src/repositories/unit-of-work.js";
import { ListQuery, Page, toPage } from "../../src/utils/pagination.js";
import { Actor } from "../../src/utils/actor.js";
import { UserRole } from "@loompilot/shared";
import { ConflictError } from "../../src/errors/index.js";

class FakeWorkforceRepository implements IWorkforceRepository {
  private workers: Worker[] = [];
  private attendance: AttendanceRecord[] = [];
  private outputs: DailyOutput[] = [];

  async createWorker(data: NewWorker): Promise<Worker> {
    const worker: Worker = {
      id: `wrk_${Date.now()}_${Math.random()}`,
      tenantId: data.tenantId,
      workerCode: data.workerCode,
      name: data.name,
      skillLevel: data.skillLevel ?? "semi_skilled",
      hourlyRatePaise: data.hourlyRatePaise ?? 12000,
      assignedProcessId: data.assignedProcessId,
      active: data.active ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.workers.push(worker);
    return worker;
  }

  async findWorkerById(tenantId: string, id: string): Promise<Worker | null> {
    return this.workers.find((w) => w.tenantId === tenantId && w.id === id) || null;
  }

  async findWorkerByCode(tenantId: string, workerCode: string): Promise<Worker | null> {
    return this.workers.find((w) => w.tenantId === tenantId && w.workerCode === workerCode) || null;
  }

  async listWorkers(tenantId: string, query?: ListQuery): Promise<Page<Worker>> {
    const filtered = this.workers.filter((w) => w.tenantId === tenantId && w.active);
    return toPage(filtered, filtered.length, query?.page || 1, query?.limit || 50);
  }

  async recordAttendance(tenantId: string, records: AttendanceItem[]): Promise<AttendanceRecord[]> {
    const results: AttendanceRecord[] = [];
    for (const rec of records) {
      let existing = this.attendance.find(
        (a) => a.tenantId === tenantId && a.workerId === rec.workerId && a.date === rec.date
      );
      if (existing) {
        existing.isPresent = rec.isPresent;
        existing.hoursWorked = rec.hoursWorked ?? 8;
        results.push(existing);
      } else {
        const item: AttendanceRecord = {
          id: `att_${Date.now()}_${Math.random()}`,
          tenantId,
          workerId: rec.workerId,
          date: rec.date,
          isPresent: rec.isPresent,
          hoursWorked: rec.hoursWorked ?? 8,
          createdAt: new Date(),
        };
        this.attendance.push(item);
        results.push(item);
      }
    }
    return results;
  }

  async getAttendance(tenantId: string, date: string): Promise<AttendanceRecord[]> {
    return this.attendance.filter((a) => a.tenantId === tenantId && a.date === date);
  }

  async findDailyOutputByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string
  ): Promise<DailyOutput | null> {
    return (
      this.outputs.find((o) => o.tenantId === tenantId && o.idempotencyKey === idempotencyKey) || null
    );
  }

  async upsertDailyOutput(data: NewDailyOutput): Promise<DailyOutput> {
    let existing = this.outputs.find(
      (o) =>
        o.tenantId === data.tenantId &&
        o.orderId === data.orderId &&
        o.processId === data.processId &&
        o.date === data.date
    );
    if (existing) {
      existing.quantityProduced = data.quantityProduced;
      existing.quantityDefective = data.quantityDefective ?? 0;
      existing.operatorId = data.operatorId;
      existing.notes = data.notes;
      existing.idempotencyKey = data.idempotencyKey;
      existing.updatedAt = new Date();
      return existing;
    }

    const output: DailyOutput = {
      id: `out_${Date.now()}_${Math.random()}`,
      tenantId: data.tenantId,
      orderId: data.orderId,
      processId: data.processId,
      date: data.date,
      quantityProduced: data.quantityProduced,
      quantityDefective: data.quantityDefective ?? 0,
      operatorId: data.operatorId,
      notes: data.notes,
      idempotencyKey: data.idempotencyKey,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.outputs.push(output);
    return output;
  }

  async getOutputsForOrder(tenantId: string, orderId: string): Promise<DailyOutput[]> {
    return this.outputs.filter((o) => o.tenantId === tenantId && o.orderId === orderId);
  }
}

describe("Unit: WorkforceService", () => {
  let fakeRepo: FakeWorkforceRepository;
  let fakeUow: FakeUnitOfWork;
  let service: WorkforceService;
  const actor: Actor = {
    userId: "usr_mgr",
    email: "manager@loompilot.test",
    role: UserRole.MANAGER,
    tenantId: "tenant_wf_unit",
  };

  beforeEach(() => {
    fakeRepo = new FakeWorkforceRepository();
    fakeUow = new FakeUnitOfWork();
    service = new WorkforceService(fakeRepo, fakeUow);
  });

  it("creates a worker and rejects duplicate workerCode", async () => {
    const w1 = await service.createWorker(actor, {
      workerCode: "WRK-001",
      name: "Ramesh Babu",
      skillLevel: "skilled",
    });

    expect(w1.id).toBeDefined();
    expect(w1.workerCode).toBe("WRK-001");

    await expect(
      service.createWorker(actor, {
        workerCode: "WRK-001",
        name: "Duplicate Worker",
      })
    ).rejects.toThrow(ConflictError);
  });

  it("records daily output idempotently and triggers monitoring run", async () => {
    const monitoringMock = vi.fn().mockResolvedValue(undefined);
    service.registerMonitoringTrigger(monitoringMock);

    const out1 = await service.recordDailyOutput(actor, {
      orderId: "ord_101",
      processId: "proc_201",
      date: "2026-10-28",
      quantityProduced: 250,
      idempotencyKey: "idem_key_101",
    });

    expect(out1.quantityProduced).toBe(250);
    expect(monitoringMock).toHaveBeenCalledWith("tenant_wf_unit", "ord_101");

    // Second call with same idempotency key should return original without re-triggering
    monitoringMock.mockClear();
    const out2 = await service.recordDailyOutput(actor, {
      orderId: "ord_101",
      processId: "proc_201",
      date: "2026-10-28",
      quantityProduced: 250,
      idempotencyKey: "idem_key_101",
    });

    expect(out2.id).toBe(out1.id);
    expect(monitoringMock).not.toHaveBeenCalled();
  });
});

