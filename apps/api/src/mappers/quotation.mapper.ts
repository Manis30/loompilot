import { Quotation } from "../interfaces/quotation.repository.js";
import { UserRole } from "@loompilot/shared";

export function toQuotationResponse(quote: Quotation, role?: UserRole) {
  const isStore = role === UserRole.STORE;

  return {
    id: quote.id,
    _id: quote.id,
    tenantId: quote.tenantId,
    enquiryId: quote.enquiryId,
    customerId: quote.customerId,
    quotationNumber: quote.quotationNumber,
    lineItems: quote.lineItems.map((li) => ({
      materialId: li.materialId,
      materialName: li.materialName,
      requiredQty: li.requiredQty,
      unit: li.unit,
      onHandQty: li.onHandQty,
      reservedQty: li.reservedQty,
      toPurchaseQty: li.toPurchaseQty,
      unitCostPaise: isStore ? undefined : li.unitCostPaise,
      totalCostPaise: isStore ? undefined : li.totalCostPaise,
      supplierLeadDays: li.supplierLeadDays,
    })),
    materialCostPaise: isStore ? undefined : quote.materialCostPaise,
    processingCostPaise: isStore ? undefined : quote.processingCostPaise,
    overheadCostPaise: isStore ? undefined : quote.overheadCostPaise,
    wastagePct: isStore ? undefined : quote.wastagePct,
    wastageCostPaise: isStore ? undefined : quote.wastageCostPaise,
    riskBufferPct: isStore ? undefined : quote.riskBufferPct,
    riskBufferCostPaise: isStore ? undefined : quote.riskBufferCostPaise,
    subtotalCostPaise: isStore ? undefined : quote.subtotalCostPaise,
    marginPct: isStore ? undefined : quote.marginPct,
    profitPaise: isStore ? undefined : quote.profitPaise,
    finalPricePaise: quote.finalPricePaise,
    etaDate: quote.etaDate,
    validUntil: quote.validUntil,
    status: quote.status,
    explanation: quote.explanation,
    assumptions: quote.assumptions,
    inputsSnapshot: quote.inputsSnapshot,
    generationError: quote.generationError,
    approvedBy: quote.approvedBy,
    approvedAt: quote.approvedAt,
    sentAt: quote.sentAt,
    createdAt: quote.createdAt,
    updatedAt: quote.updatedAt,
  };
}

