import {
  IAgentsClient,
  GenerateDraftRequest,
  RecalculateQuotationRequest,
  QuotationCalculationResult,
} from "../../interfaces/agents-client.js";

/**
 * Production wiring until Stage 4 (Python Agents Service):
 * Refuses all calculation in Node and returns failure so the quotation
 * transitions immediately to generation_failed state for user retry.
 */
export class UnavailableAgentsClient implements IAgentsClient {
  async requestDraft(_req: GenerateDraftRequest): Promise<{ status: "failed"; error: string }> {
    return {
      status: "failed",
      error: "Agents service is not yet connected. Ready for user retry in Stage 4.",
    };
  }

  async recalculate(_req: RecalculateQuotationRequest): Promise<QuotationCalculationResult> {
    throw new Error(
      "Quotation recalculation is handled exclusively by Python agents in /v1/quotations/recalculate. Node does not implement formulas."
    );
  }
}
