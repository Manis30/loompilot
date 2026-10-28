import { describe, it, expect, beforeEach, vi } from "vitest";
import { DeliveryService } from "../../src/services/delivery.service.js";
import {
  IDeliveryRepository,
  Delivery,
  NewDelivery,
} from "../../src/interfaces/delivery.repository.js";
import {
  IOrderRepository,
  ProductionOrder,
  NewProductionOrder,
} from "../../src/interfaces/order.repository.js";
import { FakeUnitOfWork } from "../fakes/fake-unit-of-work.js";
import { ListQuery, Page, toPage } from "../../src/utils/pagination.js";
import { Actor } from "../../src/utils/actor.js";
import { DeliveryStatus, OrderStatus, UserRole } from "@loompilot/shared";
import { NotFoundError } from "../../src/errors/index.js";

class FakeDeliveryRepository implements IDeliveryRepository {
  private deliveries: Delivery[] = [];

  async create(data: NewDelivery): Promise<Delivery> {
    const delivery: Delivery = {
      id: `del_${Date.now()}_${Math.random()}`,
      tenantId: data.tenantId,
      orderId: data.orderId,
      customerId: data.customerId,
      deliveryNumber: data.deliveryNumber || `DEL-0000${this.deliveries.length + 1}`,
      deliveredQuantity: data.deliveredQuantity,
      deliveryDate: data.deliveryDate,
      status: data.status ?? DeliveryStatus.DELIVERED,
      isOnTime: data.isOnTime,
      invoiceNumber: data.invoiceNumber || `INV-0000${this.deliveries.length + 1}`,
      totalInvoicePaise: data.totalInvoicePaise,
      receivedBy: data.receivedBy,
      notes: data.notes,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.deliveries.push(delivery);
    return delivery;
  }

  async findById(tenantId: string, id: string): Promise<Delivery | null> {
    return this.deliveries.find((d) => d.tenantId === tenantId && d.id === id) || null;
  }

  async findByDeliveryNumber(tenantId: string, deliveryNumber: string): Promise<Delivery | null> {
    return this.deliveries.find((d) => d.tenantId === tenantId && d.deliveryNumber === deliveryNumber) || null;
  }

  async list(tenantId: string, query?: ListQuery): Promise<Page<Delivery>> {
    const filtered = this.deliveries.filter((d) => d.tenantId === tenantId);
    return toPage(filtered, filtered.length, query?.page || 1, query?.limit || 50);
  }

  async count(tenantId: string): Promise<number> {
    return this.deliveries.filter((d) => d.tenantId === tenantId).length;
  }
}

class FakeOrderRepoForDelivery implements IOrderRepository {
  private orders: ProductionOrder[] = [];

  addOrder(order: ProductionOrder) {
    this.orders.push(order);
  }

  async create(data: NewProductionOrder): Promise<ProductionOrder> {
    const o: ProductionOrder = {
      ...data,
      id: "ord_1",
      orderNumber: "PO-00001",
      unit: data.unit ?? "meters",
      status: data.status ?? OrderStatus.PLANNED,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.orders.push(o);
    return o;
  }

  async findById(tenantId: string, id: string): Promise<ProductionOrder | null> {
    return this.orders.find((o) => o.tenantId === tenantId && o.id === id) || null;
  }

  async findByOrderNumber(): Promise<ProductionOrder | null> { return null; }

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

  async list(): Promise<Page<ProductionOrder>> { return toPage([], 0, 1, 10); }
  async count(): Promise<number> { return this.orders.length; }
}

describe("Unit: DeliveryService", () => {
  let fakeDeliveryRepo: FakeDeliveryRepository;
  let fakeOrderRepo: FakeOrderRepoForDelivery;
  let fakeUow: FakeUnitOfWork;
  let service: DeliveryService;

  const actor: Actor = {
    userId: "usr_store",
    email: "store@loompilot.test",
    role: UserRole.STORE,
    tenantId: "tenant_del_unit",
  };

  beforeEach(() => {
    fakeDeliveryRepo = new FakeDeliveryRepository();
    fakeOrderRepo = new FakeOrderRepoForDelivery();
    fakeUow = new FakeUnitOfWork();
    service = new DeliveryService(fakeDeliveryRepo, fakeOrderRepo, fakeUow);

    fakeOrderRepo.addOrder({
      id: "ord_100",
      tenantId: actor.tenantId,
      quotationId: "qt_100",
      customerId: "cust_100",
      orderNumber: "PO-00100",
      productName: "Cotton Sheeting",
      totalQuantity: 1000,
      unit: "meters",
      status: OrderStatus.IN_PROGRESS,
      startDate: "2026-11-01",
      targetDeliveryDate: "2026-11-15",
      plan: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it("records delivery on time, completes order, and fires payment follow-up trigger", async () => {
    const triggerMock = vi.fn().mockResolvedValue(undefined);
    service.registerDeliveryTrigger(triggerMock);

    const delivery = await service.recordDelivery(actor, {
      orderId: "ord_100",
      customerId: "cust_100",
      deliveredQuantity: 1000,
      deliveryDate: "2026-11-14",
      totalInvoicePaise: 5000000,
    });

    expect(delivery.id).toBeDefined();
    expect(delivery.isOnTime).toBe(true);

    // Verify order completed
    const order = await fakeOrderRepo.findById(actor.tenantId, "ord_100");
    expect(order!.status).toBe(OrderStatus.COMPLETED);
    expect(order!.actualDeliveryDate).toBe("2026-11-14");

    // Verify event-triggered payment callback was invoked immediately
    expect(triggerMock).toHaveBeenCalledWith(actor.tenantId, delivery);
  });

  it("marks delivery as delayed when past targetDeliveryDate", async () => {
    const delivery = await service.recordDelivery(actor, {
      orderId: "ord_100",
      customerId: "cust_100",
      deliveredQuantity: 1000,
      deliveryDate: "2026-11-20", // Target was 2026-11-15
      totalInvoicePaise: 5000000,
    });

    expect(delivery.isOnTime).toBe(false);
  });

  it("throws NotFoundError when order is missing", async () => {
    await expect(
      service.recordDelivery(actor, {
        orderId: "nonexistent",
        customerId: "cust_100",
        deliveredQuantity: 500,
        totalInvoicePaise: 2500000,
      })
    ).rejects.toThrow(NotFoundError);
  });
});

