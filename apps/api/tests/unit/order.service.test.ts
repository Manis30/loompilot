import { describe, it, expect, beforeEach } from "vitest";
import { OrderService } from "../../src/services/order.service.js";
import {
  IOrderRepository,
  ProductionOrder,
  NewProductionOrder,
} from "../../src/interfaces/order.repository.js";
import {
  IWorkforceRepository,
  Worker,
  NewWorker,
  AttendanceRecord,
  AttendanceItem,
  DailyOutput,
  NewDailyOutput,
} from "../../src/interfaces/workforce.repository.js";
import { FakeUnitOfWork } from "../fakes/fake-unit-of-work.js";
import { ListQuery, Page, toPage } from "../../src/utils/pagination.js";
import { Actor } from "../../src/utils/actor.js";
import { OrderStatus, ProcessName, UserRole } from "@loompilot/shared";
import { NotFoundError } from "../../src/errors/index.js";

class FakeOrderRepository implements IOrderRepository {
  private orders: ProductionOrder[] = [];

  async create(data: NewProductionOrder): Promise<ProductionOrder> {
    const order: ProductionOrder = {
      id: `ord_${Date.now()}_${Math.random()}`,
      tenantId: data.tenantId,
      quotationId: data.quotationId,
      customerId: data.customerId,
      orderNumber: data.orderNumber || `ORD-0000${this.orders.length + 1}`,
      productName: data.productName,
      totalQuantity: data.totalQuantity,
      unit: data.unit ?? "meters",
      status: data.status ?? OrderStatus.PLANNED,
      startDate: data.startDate,
      targetDeliveryDate: data.targetDeliveryDate,
      plan: data.plan,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.orders.push(order);
    return order;
  }

  async findById(tenantId: string, id: string): Promise<ProductionOrder | null> {
    return this.orders.find((o) => o.tenantId === tenantId && o.id === id) || null;
  }

  async findByOrderNumber(tenantId: string, orderNumber: string): Promise<ProductionOrder | null> {
    return this.orders.find((o) => o.tenantId === tenantId && o.orderNumber === orderNumber) || null;
  }

  async updateStatus(
    tenantId: string,
    id: string,
    status: OrderStatus,
    actualDeliveryDate?: string
  ): Promise<ProductionOrder | null> {
    const order = await this.findById(tenantId, id);
    if (!order) return null;
    order.status = status;
    if (actualDeliveryDate) order.actualDeliveryDate = actualDeliveryDate;
    order.updatedAt = new Date();
    return order;
  }

  async list(tenantId: string, query?: ListQuery): Promise<Page<ProductionOrder>> {
    const filtered = this.orders.filter((o) => o.tenantId === tenantId);
    return toPage(filtered, filtered.length, query?.page || 1, query?.limit || 50);
  }

  async count(tenantId: string): Promise<number> {
    return this.orders.filter((o) => o.tenantId === tenantId).length;
  }
}

class FakeWorkforceForOrder implements IWorkforceRepository {
  private outputs: DailyOutput[] = [];

  addOutput(output: DailyOutput) {
    this.outputs.push(output);
  }

  async createWorker(): Promise<Worker> { throw new Error("not implemented"); }
  async findWorkerById(): Promise<Worker | null> { return null; }
  async findWorkerByCode(): Promise<Worker | null> { return null; }
  async listWorkers(): Promise<Page<Worker>> { return toPage([], 0, 1, 10); }
  async recordAttendance(): Promise<AttendanceRecord[]> { return []; }
  async getAttendance(): Promise<AttendanceRecord[]> { return []; }
  async findDailyOutputByIdempotencyKey(): Promise<DailyOutput | null> { return null; }
  async upsertDailyOutput(data: NewDailyOutput): Promise<DailyOutput> {
    const out: DailyOutput = {
      ...data,
      id: `out_${Date.now()}`,
      quantityDefective: data.quantityDefective ?? 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.outputs.push(out);
    return out;
  }
  async getOutputsForOrder(tenantId: string, orderId: string): Promise<DailyOutput[]> {
    return this.outputs.filter((o) => o.tenantId === tenantId && o.orderId === orderId);
  }
}

describe("Unit: OrderService", () => {
  let fakeOrderRepo: FakeOrderRepository;
  let fakeWorkforceRepo: FakeWorkforceForOrder;
  let fakeUow: FakeUnitOfWork;
  let service: OrderService;
  const actor: Actor = {
    userId: "usr_owner",
    email: "owner@loompilot.test",
    role: UserRole.OWNER,
    tenantId: "tenant_ord_unit",
  };

  beforeEach(() => {
    fakeOrderRepo = new FakeOrderRepository();
    fakeWorkforceRepo = new FakeWorkforceForOrder();
    fakeUow = new FakeUnitOfWork();
    service = new OrderService(fakeOrderRepo, fakeWorkforceRepo, fakeUow);
  });

  it("calculates output variance and identifies deficits against process plan", async () => {
    const order = await fakeOrderRepo.create({
      tenantId: actor.tenantId,
      quotationId: "qt_101",
      customerId: "cust_201",
      productName: "Cotton Poplin 60s",
      totalQuantity: 1000,
      startDate: "2026-11-01",
      targetDeliveryDate: "2026-11-10",
      plan: [
        {
          processId: "proc_warp",
          processName: ProcessName.WARPING,
          sequence: 1,
          targetQty: 1000,
          dailyTarget: 250,
          startDate: "2026-11-01",
          endDate: "2026-11-04",
          completedQty: 0,
        },
        {
          processId: "proc_weave",
          processName: ProcessName.WEAVING,
          sequence: 2,
          targetQty: 1000,
          dailyTarget: 250,
          startDate: "2026-11-05",
          endDate: "2026-11-08",
          completedQty: 0,
        },
      ],
    });

    // Add daily outputs for Warping: 300 on day 1, 400 on day 2 = 700 total (target is 1000)
    fakeWorkforceRepo.addOutput({
      id: "out_1",
      tenantId: actor.tenantId,
      orderId: order.id,
      processId: "proc_warp",
      date: "2026-11-01",
      quantityProduced: 300,
      quantityDefective: 5,
      idempotencyKey: "k1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    fakeWorkforceRepo.addOutput({
      id: "out_2",
      tenantId: actor.tenantId,
      orderId: order.id,
      processId: "proc_warp",
      date: "2026-11-02",
      quantityProduced: 400,
      quantityDefective: 10,
      idempotencyKey: "k2",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const report = await service.getVariance(actor, order.id);

    expect(report.orderNumber).toBe(order.orderNumber);
    expect(report.varianceData).toHaveLength(2);

    const warpingVariance = report.varianceData[0]!;
    expect(warpingVariance.processName).toBe(ProcessName.WARPING);
    expect(warpingVariance.plannedQty).toBe(1000);
    expect(warpingVariance.actualQty).toBe(700);
    expect(warpingVariance.deficitQty).toBe(300);
    expect(warpingVariance.isBehind).toBe(true);
  });

  it("throws NotFoundError when order does not exist", async () => {
    await expect(service.getVariance(actor, "unknown-id")).rejects.toThrow(NotFoundError);
  });
});

