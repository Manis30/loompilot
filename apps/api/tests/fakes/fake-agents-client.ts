import {
  IAgentsClient,
  GenerateDraftRequest,
  RecalculateQuotationRequest,
  QuotationCalculationResult,
} from "../../src/interfaces/agents-client.js";

export class FakeAgentsClient implements IAgentsClient {
  public shouldFail: boolean = false;
  public failureMessage: string = "Agent service timed out";

  async requestDraft(_req: GenerateDraftRequest): Promise<{ status: "queued" | "completed" | "failed"; error?: string }> {
    if (this.shouldFail) {
      return { status: "failed", error: this.failureMessage };
    }
    return { status: "queued" };
  }

  async recalculate(req: RecalculateQuotationRequest): Promise<QuotationCalculationResult> {
    if (this.shouldFail) {
      throw new Error(this.failureMessage);
    }

    return {
      lineItems: (req.lineItems || []).map((li) => ({
        ...li,
        materialName: "Mock Material",
        unit: "kg",
        onHandQty: 100,
        reservedQty: 0,
        toPurchaseQty: Math.max(0, li.requiredQty - 100),
        unitCostPaise: li.unitCostPaise || 25000,
        totalCostPaise: li.requiredQty * (li.unitCostPaise || 25000),
        supplierLeadDays: 7,
      })),
      materialCostPaise: 1000000,
      processingCostPaise: 200000,
      overheadCostPaise: 50000,
      wastagePct: 2.0,
      wastageCostPaise: 20000,
      riskBufferPct: 3.0,
      riskBufferCostPaise: 30000,
      subtotalCostPaise: 1300000,
      marginPct: req.marginPct || 15.0,
      profitPaise: 195000,
      finalPricePaise: 1495000,
      etaDate: "2026-11-30",
      validUntil: "2026-11-15",
      explanation: "Recalculated by FakeAgentsClient without any Node math",
      assumptions: req.assumptions || ["Standard lead times apply"],
    };
  }
}

