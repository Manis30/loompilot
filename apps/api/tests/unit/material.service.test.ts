import { describe, it, expect, beforeEach } from "vitest";
import { MaterialService } from "../../src/services/material.service.js";
import {
  IMaterialRepository,
  Material,
  NewMaterial,
  StockMovement,
  NewStockMovement,
  Reservation,
  NewReservation,
  PriceHistory,
  NewPriceHistory,
} from "../../src/interfaces/material.repository.js";
import { FakeUnitOfWork } from "../fakes/fake-unit-of-work.js";
import { ListQuery, Page, toPage } from "../../src/utils/pagination.js";
import { Actor } from "../../src/utils/actor.js";
import { MaterialType, StockMovementType, UserRole } from "@loompilot/shared";
import { BadRequestError, NotFoundError, StockInsufficientError } from "../../src/errors/index.js";

class FakeMaterialRepository implements IMaterialRepository {
  private materials: Material[] = [];
  private movements: StockMovement[] = [];
  private reservations: Reservation[] = [];
  private prices: PriceHistory[] = [];

  async create(data: NewMaterial): Promise<Material> {
    const material: Material = {
      id: `mat_${Date.now()}_${Math.random()}`,
      tenantId: data.tenantId,
      code: data.code,
      name: data.name,
      type: data.type,
      unit: data.unit,
      currentRatePaise: data.currentRatePaise,
      avgCostPaise: data.avgCostPaise,
      onHandQuantity: data.onHandQuantity ?? 0,
      reservedQuantity: data.reservedQuantity ?? 0,
      reorderLevel: data.reorderLevel ?? 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.materials.push(material);
    return material;
  }

  async findById(tenantId: string, id: string): Promise<Material | null> {
    return this.materials.find((m) => m.tenantId === tenantId && m.id === id) || null;
  }

  async findByCode(tenantId: string, code: string): Promise<Material | null> {
    return this.materials.find((m) => m.tenantId === tenantId && m.code === code) || null;
  }

  async update(tenantId: string, id: string, data: Partial<Material>): Promise<Material | null> {
    const item = await this.findById(tenantId, id);
    if (!item) return null;
    Object.assign(item, data, { updatedAt: new Date() });
    return item;
  }

  async list(tenantId: string, query?: ListQuery): Promise<Page<Material>> {
    const filtered = this.materials.filter((m) => m.tenantId === tenantId);
    return toPage(filtered, filtered.length, query?.page || 1, query?.limit || 50);
  }

  async recordMovement(data: NewStockMovement): Promise<StockMovement> {
    const movement: StockMovement = {
      id: `mov_${Date.now()}_${Math.random()}`,
      tenantId: data.tenantId,
      materialId: data.materialId,
      type: data.type,
      quantity: data.quantity,
      previousBalance: data.previousBalance,
      newBalance: data.newBalance,
      referenceType: data.referenceType,
      referenceId: data.referenceId,
      notes: data.notes,
      createdAt: new Date(),
    };
    this.movements.push(movement);
    return movement;
  }

  async getMovements(tenantId: string, materialId: string): Promise<StockMovement[]> {
    return this.movements
      .filter((m) => m.tenantId === tenantId && m.materialId === materialId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createReservation(data: NewReservation): Promise<Reservation> {
    const reservation: Reservation = {
      id: `res_${Date.now()}_${Math.random()}`,
      tenantId: data.tenantId,
      materialId: data.materialId,
      orderId: data.orderId,
      quantity: data.quantity,
      status: data.status || "reserved",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.reservations.push(reservation);
    return reservation;
  }

  async findReservation(tenantId: string, orderId: string, materialId: string): Promise<Reservation | null> {
    return (
      this.reservations.find(
        (r) => r.tenantId === tenantId && r.orderId === orderId && r.materialId === materialId
      ) || null
    );
  }

  async updateReservationStatus(
    tenantId: string,
    id: string,
    status: "reserved" | "allocated" | "released"
  ): Promise<void> {
    const r = this.reservations.find((item) => item.tenantId === tenantId && item.id === id);
    if (r) {
      r.status = status;
      r.updatedAt = new Date();
    }
  }

  async recordPrice(data: NewPriceHistory): Promise<PriceHistory> {
    const price: PriceHistory = {
      id: `prc_${Date.now()}_${Math.random()}`,
      tenantId: data.tenantId,
      materialId: data.materialId,
      date: data.date,
      ratePaise: data.ratePaise,
      source: data.source || "manual",
      createdAt: new Date(),
    };
    this.prices.push(price);
    return price;
  }

  async getPriceHistory(tenantId: string, materialId: string): Promise<PriceHistory[]> {
    return this.prices
      .filter((p) => p.tenantId === tenantId && p.materialId === materialId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  async mutateStock(
    tenantId: string,
    id: string,
    onHandChange: number,
    reservedChange: number
  ): Promise<Material> {
    const item = await this.findById(tenantId, id);
    if (!item) {
      throw new NotFoundError(`Material with ID ${id} not found`);
    }
    if (onHandChange < 0 && item.onHandQuantity < -onHandChange) {
      throw new StockInsufficientError(`Insufficient stock for material ${item.name}`);
    }
    if (reservedChange < 0 && item.reservedQuantity < -reservedChange) {
      throw new StockInsufficientError(`Insufficient reserved stock for material ${item.name}`);
    }
    item.onHandQuantity += onHandChange;
    item.reservedQuantity += reservedChange;
    item.updatedAt = new Date();
    return item;
  }

  async getStockSummary(tenantId: string): Promise<any[]> {
    return this.materials
      .filter((m) => m.tenantId === tenantId)
      .map((m) => ({
        id: m.id,
        code: m.code,
        name: m.name,
        unit: m.unit,
        onHandQuantity: m.onHandQuantity,
        reservedQuantity: m.reservedQuantity,
        availableQuantity: Math.max(0, m.onHandQuantity - m.reservedQuantity),
        avgCostPaise: m.avgCostPaise,
        totalValuePaise: Math.round(m.onHandQuantity * m.avgCostPaise),
      }));
  }

  async appendPriceHistory(
    tenantId: string,
    materialId: string,
    effectiveDate: string,
    ratePaise: number,
    source: string,
    referenceId?: string
  ): Promise<PriceHistory> {
    const price: PriceHistory = {
      id: `prc_${Date.now()}_${Math.random()}`,
      tenantId,
      materialId,
      date: effectiveDate,
      ratePaise,
      source,
      referenceId,
      createdAt: new Date(),
    };
    this.prices.push(price);
    return price;
  }

  async backfillPriceHistory(tenantId: string, materialId: string, points: any[]): Promise<number> {
    for (const p of points) {
      await this.appendPriceHistory(
        tenantId,
        materialId,
        p.date,
        p.ratePaise,
        p.source || "historical_import",
        p.referenceId
      );
    }
    return points.length;
  }
}

describe("Unit: MaterialService", () => {
  let fakeRepo: FakeMaterialRepository;
  let fakeUow: FakeUnitOfWork;
  let service: MaterialService;
  const actor: Actor = {
    userId: "usr_mgr",
    email: "manager@loompilot.test",
    role: UserRole.MANAGER,
    tenantId: "tenant_mat_unit",
  };

  beforeEach(() => {
    fakeRepo = new FakeMaterialRepository();
    fakeUow = new FakeUnitOfWork();
    service = new MaterialService(fakeRepo, fakeUow);
  });

  it("creates a material and retrieves it by id", async () => {
    const material = await service.create(actor, {
      code: "YARN-COT-40",
      name: "Cotton Yarn 40s",
      type: MaterialType.YARN,
      unit: "kg",
      currentRatePaise: 28000,
      avgCostPaise: 27500,
      onHandQuantity: 100,
      reorderLevel: 50,
    });

    expect(material.id).toBeDefined();
    expect(material.code).toBe("YARN-COT-40");

    const found = await service.getById(actor, material.id);
    expect(found.name).toBe("Cotton Yarn 40s");

    await expect(service.getById(actor, "unknown-id")).rejects.toThrow(NotFoundError);
  });

  it("records receipt movement and increments onHandQuantity", async () => {
    const material = await service.create(actor, {
      code: "DYE-INDIGO",
      name: "Indigo Dye",
      type: MaterialType.DYE,
      unit: "kg",
      currentRatePaise: 45000,
      avgCostPaise: 42000,
      onHandQuantity: 50,
    });

    const movement = await service.recordMovement(actor, material.id, {
      type: StockMovementType.RECEIPT,
      quantity: 30,
      referenceType: "receipt",
      notes: "Batch 101 receipt",
    });

    expect(movement.previousBalance).toBe(50);
    expect(movement.newBalance).toBe(80);

    const updated = await service.getById(actor, material.id);
    expect(updated.onHandQuantity).toBe(80);
  });

  it("records issue movement and rejects if insufficient stock", async () => {
    const material = await service.create(actor, {
      code: "CHEM-CAUSTIC",
      name: "Caustic Soda",
      type: MaterialType.CHEMICAL,
      unit: "kg",
      currentRatePaise: 8000,
      avgCostPaise: 7500,
      onHandQuantity: 20,
    });

    await expect(
      service.recordMovement(actor, material.id, {
        type: StockMovementType.ISSUE,
        quantity: 50,
        referenceType: "order_issue",
      })
    ).rejects.toThrow(BadRequestError);

    const successfulIssue = await service.recordMovement(actor, material.id, {
      type: StockMovementType.ISSUE,
      quantity: 15,
      referenceType: "order_issue",
    });

    expect(successfulIssue.newBalance).toBe(5);
    const updated = await service.getById(actor, material.id);
    expect(updated.onHandQuantity).toBe(5);
  });
});

