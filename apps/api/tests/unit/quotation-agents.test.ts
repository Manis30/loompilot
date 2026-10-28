import { describe, it, expect, beforeEach } from "vitest";
import { QuotationService } from "../../src/services/quotation.service.js";
import {
  IQuotationRepository,
  Quotation,
  NewQuotation,
} from "../../src/interfaces/quotation.repository.js";
import { FakeAgentsClient } from "../fakes/fake-agents-client.js";
import { FakeUnitOfWork } from "../fakes/fake-unit-of-work.js";
import { Actor } from "../../src/utils/actor.js";
import { QuotationStatus, UserRole } from "@loompilot/shared";

class FakeQuotationRepoForAgentTest implements IQuotationRepository {
  private quotations: Quotation[] = [];

  async create(data: NewQuotation): Promise<Quotation> {
    const q: Quotation = {
      id: `qt_${Date.now()}_${Math.random()}`,
      tenantId: data.tenantId,
      enquiryId: data.enquiryId,
      customerId: data.customerId,
      quotationNumber: data.quotationNumber || `QT-${this.quotations.length + 1}`,
      lineItems: data.lineItems || [],
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
      status: data.status || QuotationStatus.DRAFT,
      explanation: data.explanation,
      assumptions: data.assumptions,
      inputsSnapshot: data.inputsSnapshot,
      generationError: data.generationError,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.quotations.push(q);
    return q;
  }

  async findById(tenantId: string, id: string): Promise<Quotation | null> {
    return this.quotations.find((q) => q.tenantId === tenantId && q.id === id) || null;
  }

  async findByQuotationNumber(tenantId: string, quotationNumber: string): Promise<Quotation | null> {
    return this.quotations.find((q) => q.tenantId === tenantId && q.quotationNumber === quotationNumber) || null;
  }

  async list(tenantId: string): Promise<any> {
    const items = this.quotations.filter((q) => q.tenantId === tenantId);
    return { items, total: items.length, page: 1, limit: 50 };
  }

  async count(tenantId: string): Promise<number> {
    return this.quotations.filter((q) => q.tenantId === tenantId).length;
  }

  async update(tenantId: string, id: string, update: Partial<Quotation>): Promise<Quotation | null> {
    const q = await this.findById(tenantId, id);
    if (!q) return null;
    Object.assign(q, update, { updatedAt: new Date() });
    return q;
  }
}

describe("Unit: QuotationService Agent Delegation (No Formulas in Node)", () => {
  let fakeRepo: FakeQuotationRepoForAgentTest;
  let fakeAgents: FakeAgentsClient;
  let service: QuotationService;

  const actor: Actor = {
    userId: "usr_sales",
    email: "sales@loompilot.test",
    role: UserRole.SALES,
    tenantId: "tenant_qt_agents",
  };

  beforeEach(() => {
    fakeRepo = new FakeQuotationRepoForAgentTest();
    fakeAgents = new FakeAgentsClient();
    service = new QuotationService(
      fakeRepo,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      new FakeUnitOfWork(),
      undefined,
      fakeAgents
    );
  });

  it("sets quotation to generation_failed state when agent request fails or times out (never hangs)", async () => {
    fakeAgents.shouldFail = true;
    fakeAgents.failureMessage = "Agent connection timed out after 10000ms";

    const quotation = await service.requestDraft(actor, "enq_123");

    expect(quotation.status).toBe(QuotationStatus.GENERATION_FAILED);
    expect(quotation.generationError).toBe("Agent connection timed out after 10000ms");
    expect(quotation.finalPricePaise).toBe(0); // Zero Node calculation
  });

  it("recalculates quotation exclusively via agents client without Node-side formulas", async () => {
    const initial = await fakeRepo.create({
      tenantId: actor.tenantId,
      enquiryId: "enq_123",
      customerId: "cust_123",
      quotationNumber: "QT-00001",
      lineItems: [],
      materialCostPaise: 0,
      processingCostPaise: 0,
      overheadCostPaise: 0,
      wastagePct: 0,
      wastageCostPaise: 0,
      riskBufferPct: 0,
      riskBufferCostPaise: 0,
      subtotalCostPaise: 0,
      marginPct: 0,
      profitPaise: 0,
      finalPricePaise: 0,
      etaDate: "2026-11-20",
      validUntil: "2026-11-05",
      status: QuotationStatus.DRAFT,
      explanation: "Initial draft",
    });

    const recalculated = await service.recalculate(actor, initial.id, {
      lineItems: [{ materialId: "mat_1", requiredQty: 500, unitCostPaise: 20000 }],
      marginPct: 20.0,
      assumptions: ["Fast-track shipping"],
    });

    // Verification: all values populated from FakeAgentsClient
    expect(recalculated.marginPct).toBe(20.0);
    expect(recalculated.finalPricePaise).toBe(1495000);
    expect(recalculated.explanation).toContain("FakeAgentsClient without any Node math");
    expect(recalculated.assumptions).toContain("Fast-track shipping");
  });
});

