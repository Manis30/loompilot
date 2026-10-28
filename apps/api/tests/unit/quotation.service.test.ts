import { describe, it, expect, beforeEach } from "vitest";
import { QuotationService } from "../../src/services/quotation.service.js";
import {
  IQuotationRepository,
  Quotation,
  NewQuotation,
} from "../../src/interfaces/quotation.repository.js";
import {
  ICustomerRepository,
  Customer,
  NewCustomer,
} from "../../src/interfaces/customer.repository.js";
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
import {
  IProcessRepository,
  Process,
  NewProcess,
} from "../../src/interfaces/process.repository.js";
import {
  IOrderRepository,
  ProductionOrder,
  NewProductionOrder,
} from "../../src/interfaces/order.repository.js";
import { IPdfRenderer, QuotationPdfData } from "../../src/interfaces/pdf-renderer.js";
import { FakeUnitOfWork } from "../../src/repositories/unit-of-work.js";
import { ListQuery, Page, toPage } from "../../src/utils/pagination.js";
import { Actor } from "../../src/utils/actor.js";
import {
  QuotationStatus,
  OrderStatus,
  ProcessName,
  MaterialType,
  StockMovementType,
  UserRole,
} from "@loompilot/shared";
import { BadRequestError, NotFoundError } from "../../src/errors/index.js";

class FakeQuotationRepository implements IQuotationRepository {
  private quotes: Quotation[] = [];

  async create(data: NewQuotation): Promise<Quotation> {
    const q: Quotation = {
      id: `qt_${Date.now()}_${Math.random()}`,
      tenantId: data.tenantId,
      enquiryId: data.enquiryId,
      customerId: data.customerId,
      quotationNumber: data.quotationNumber || `QT-0000${this.quotes.length + 1}`,
      lineItems: data.lineItems,
      materialCostPaise: data.materialCostPaise,
      processingCostPaise: data.processingCostPaise,
      overheadCostPaise: data.overheadCostPaise,
      wastagePct: data.wastagePct,
      wastageCostPaise: data.wastageCostPaise,
      riskBufferPct: data.riskBufferPct,
      riskBufferCostPaise: data.riskBufferCostPaise,
      subtotalCostPaise: data.subtotalCostPaise,
      marginPct: data.marginPct,
      profitPaise: data.profitPaise,
      finalPricePaise: data.finalPricePaise,
      etaDate: data.etaDate,
      validUntil: data.validUntil,
      status: data.status ?? QuotationStatus.DRAFT,
      explanation: data.explanation ?? "",
      assumptions: data.assumptions ?? [],
      inputsSnapshot: data.inputsSnapshot ?? {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.quotes.push(q);
    return q;
  }

  async findById(tenantId: string, id: string): Promise<Quotation | null> {
    return this.quotes.find((q) => q.tenantId === tenantId && q.id === id) || null;
  }

  async findByQuotationNumber(tenantId: string, quotationNumber: string): Promise<Quotation | null> {
    return this.quotes.find((q) => q.tenantId === tenantId && q.quotationNumber === quotationNumber) || null;
  }

  async update(tenantId: string, id: string, data: Partial<Quotation>): Promise<Quotation | null> {
    const quote = await this.findById(tenantId, id);
    if (!quote) return null;
    Object.assign(quote, data, { updatedAt: new Date() });
    return quote;
  }

  async list(tenantId: string, query?: ListQuery): Promise<Page<Quotation>> {
    const filtered = this.quotes.filter((q) => q.tenantId === tenantId);
    return toPage(filtered, filtered.length, query?.page || 1, query?.limit || 50);
  }

  async count(tenantId: string): Promise<number> {
    return this.quotes.filter((q) => q.tenantId === tenantId).length;
  }
}

class FakeCustomerRepo implements ICustomerRepository {
  private customers: Customer[] = [];
  async create(data: NewCustomer): Promise<Customer> {
    const c: Customer = {
      id: "cust_1",
      tenantId: data.tenantId,
      name: data.name,
      code: "CUST-001",
      contactPerson: "A",
      email: "a@test.com",
      phone: "123",
      creditPeriodDays: 30,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.customers.push(c);
    return c;
  }
  async findById(tenantId: string, id: string): Promise<Customer | null> {
    return this.customers.find((c) => c.tenantId === tenantId && c.id === id) || null;
  }
  async findByCode(): Promise<Customer | null> { return null; }
  async list(): Promise<Page<Customer>> { return toPage([], 0, 1, 10); }
  async count(): Promise<number> { return this.customers.length; }
}

class FakeMaterialRepo implements IMaterialRepository {
  private materials: Material[] = [];
  private reservations: Reservation[] = [];
  private movements: StockMovement[] = [];

  addMaterial(m: Material) { this.materials.push(m); }

  async create(): Promise<Material> { throw new Error("not needed"); }
  async findById(tenantId: string, id: string): Promise<Material | null> {
    return this.materials.find((m) => m.tenantId === tenantId && m.id === id) || null;
  }
  async findByCode(): Promise<Material | null> { return null; }
  async update(tenantId: string, id: string, data: Partial<Material>): Promise<Material | null> {
    const mat = await this.findById(tenantId, id);
    if (!mat) return null;
    Object.assign(mat, data);
    return mat;
  }
  async list(): Promise<Page<Material>> { return toPage([], 0, 1, 10); }
  async recordMovement(data: NewStockMovement): Promise<StockMovement> {
    const mov: StockMovement = { ...data, id: "mov_1", createdAt: new Date() };
    this.movements.push(mov);
    return mov;
  }
  async getMovements(): Promise<StockMovement[]> { return this.movements; }
  async createReservation(data: NewReservation): Promise<Reservation> {
    const r: Reservation = {
      ...data,
      id: "res_1",
      status: data.status || "reserved",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.reservations.push(r);
    return r;
  }
  async findReservation(): Promise<Reservation | null> { return null; }
  async updateReservationStatus(): Promise<void> {}
  async recordPrice(): Promise<PriceHistory> { throw new Error("not needed"); }
  async getPriceHistory(): Promise<PriceHistory[]> { return []; }
}

class FakeProcessRepo implements IProcessRepository {
  private procs: Process[] = [];
  addProcess(p: Process) { this.procs.push(p); }
  async create(): Promise<Process> { throw new Error("not needed"); }
  async findById(): Promise<Process | null> { return null; }
  async findByName(): Promise<Process | null> { return null; }
  async list(): Promise<Page<Process>> { return toPage([], 0, 1, 10); }
  async listAllOrdered(tenantId: string): Promise<Process[]> {
    return this.procs.filter((p) => p.tenantId === tenantId).sort((a, b) => a.sequence - b.sequence);
  }
}

class FakeOrderRepo implements IOrderRepository {
  private orders: ProductionOrder[] = [];
  async create(data: NewProductionOrder): Promise<ProductionOrder> {
    const o: ProductionOrder = {
      ...data,
      id: "ord_1",
      orderNumber: data.orderNumber || "PO-00001",
      unit: data.unit ?? "meters",
      status: data.status ?? OrderStatus.PLANNED,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.orders.push(o);
    return o;
  }
  async findById(): Promise<ProductionOrder | null> { return null; }
  async findByOrderNumber(): Promise<ProductionOrder | null> { return null; }
  async updateStatus(): Promise<ProductionOrder | null> { return null; }
  async list(): Promise<Page<ProductionOrder>> { return toPage([], 0, 1, 10); }
  async count(): Promise<number> { return this.orders.length; }
}

class FakePdfRenderer implements IPdfRenderer {
  async renderQuotation(_data: QuotationPdfData): Promise<Buffer> {
    return Buffer.from("%PDF-1.4 mock pdf");
  }
}

describe("Unit: QuotationService", () => {
  let quoteRepo: FakeQuotationRepository;
  let customerRepo: FakeCustomerRepo;
  let materialRepo: FakeMaterialRepo;
  let processRepo: FakeProcessRepo;
  let orderRepo: FakeOrderRepo;
  let pdfRenderer: FakePdfRenderer;
  let uow: FakeUnitOfWork;
  let service: QuotationService;

  const actor: Actor = {
    userId: "usr_sales",
    email: "sales@loompilot.test",
    role: UserRole.SALES,
    tenantId: "tenant_qt_unit",
  };

  beforeEach(async () => {
    quoteRepo = new FakeQuotationRepository();
    customerRepo = new FakeCustomerRepo();
    materialRepo = new FakeMaterialRepo();
    processRepo = new FakeProcessRepo();
    orderRepo = new FakeOrderRepo();
    pdfRenderer = new FakePdfRenderer();
    uow = new FakeUnitOfWork();

    service = new QuotationService(
      quoteRepo,
      customerRepo,
      materialRepo,
      processRepo,
      orderRepo,
      pdfRenderer,
      uow
    );

    // Setup initial customer and material
    await customerRepo.create({
      tenantId: actor.tenantId,
      name: "Acme Garments",
      contactPerson: "Jane",
      email: "jane@acme.test",
      phone: "123456",
    });

    materialRepo.addMaterial({
      id: "mat_1",
      tenantId: actor.tenantId,
      code: "YARN-COT-30",
      name: "Cotton Yarn 30s",
      type: MaterialType.YARN,
      unit: "kg",
      currentRatePaise: 25000,
      avgCostPaise: 24000,
      onHandQuantity: 500,
      reservedQuantity: 0,
      reorderLevel: 50,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    processRepo.addProcess({
      id: "proc_1",
      tenantId: actor.tenantId,
      name: ProcessName.WEAVING,
      sequence: 1,
      standardWastagePct: 2.0,
      avgOutputPerWorkerHour: 15,
      unit: "meters",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it("creates a draft quotation and approves it", async () => {
    const draft = await service.createDraft(actor, {
      enquiryId: "enq_1",
      customerId: "cust_1",
      lineItems: [
        {
          materialId: "mat_1",
          materialName: "Cotton Yarn 30s",
          requiredQty: 200,
          unit: "kg",
          onHandQty: 500,
          reservedQty: 0,
          toPurchaseQty: 0,
          unitCostPaise: 25000,
          totalCostPaise: 5000000,
          supplierLeadDays: 3,
        },
      ],
      materialCostPaise: 5000000,
      processingCostPaise: 1000000,
      overheadCostPaise: 500000,
      wastagePct: 2.0,
      wastageCostPaise: 130000,
      riskBufferPct: 3.0,
      riskBufferCostPaise: 195000,
      subtotalCostPaise: 6825000,
      marginPct: 15.0,
      profitPaise: 1023750,
      finalPricePaise: 7848750,
      etaDate: "2026-11-15",
      validUntil: "2026-11-01",
    });

    expect(draft.id).toBeDefined();
    expect(draft.status).toBe(QuotationStatus.DRAFT);

    const approved = await service.approve(actor, draft.id);
    expect(approved.status).toBe(QuotationStatus.APPROVED);
    expect(approved.approvedBy).toBe(actor.userId);
  });

  it("confirms quotation atomically into a production order and reserves stock", async () => {
    const draft = await service.createDraft(actor, {
      enquiryId: "enq_2",
      customerId: "cust_1",
      lineItems: [
        {
          materialId: "mat_1",
          materialName: "Cotton Yarn 30s",
          requiredQty: 200,
          unit: "kg",
          onHandQty: 500,
          reservedQty: 0,
          toPurchaseQty: 0,
          unitCostPaise: 25000,
          totalCostPaise: 5000000,
          supplierLeadDays: 3,
        },
      ],
      materialCostPaise: 5000000,
      processingCostPaise: 1000000,
      overheadCostPaise: 500000,
      wastagePct: 2.0,
      wastageCostPaise: 130000,
      riskBufferPct: 3.0,
      riskBufferCostPaise: 195000,
      subtotalCostPaise: 6825000,
      marginPct: 15.0,
      profitPaise: 1023750,
      finalPricePaise: 7848750,
      etaDate: "2026-11-15",
      validUntil: "2026-11-01",
    });

    const order = await service.confirmOrder(actor, draft.id);

    expect(order.id).toBeDefined();
    expect(order.orderNumber).toBe("PO-00001");
    expect(order.status).toBe(OrderStatus.PLANNED);

    // Stock reserved on material
    const mat = await materialRepo.findById(actor.tenantId, "mat_1");
    expect(mat!.reservedQuantity).toBe(200);

    // Quotation status updated to confirmed
    const quote = await service.getById(actor, draft.id);
    expect(quote.status).toBe(QuotationStatus.CONFIRMED);

    // Cannot confirm twice
    await expect(service.confirmOrder(actor, draft.id)).rejects.toThrow(BadRequestError);
  });
});
