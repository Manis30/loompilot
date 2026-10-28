import { Material, StockMovement, PriceHistory } from "../interfaces/material.repository.js";
import { UserRole } from "@loompilot/shared";

export function toMaterialResponse(material: Material, role?: UserRole) {
  const isStore = role === UserRole.STORE;

  return {
    id: material.id,
    _id: material.id, // For backward compatibility with tests expecting _id
    tenantId: material.tenantId,
    code: material.code,
    name: material.name,
    type: material.type,
    unit: material.unit,
    currentRatePaise: isStore ? undefined : material.currentRatePaise,
    avgCostPaise: isStore ? undefined : material.avgCostPaise,
    onHandQuantity: material.onHandQuantity,
    reservedQuantity: material.reservedQuantity,
    reorderLevel: material.reorderLevel,
    createdAt: material.createdAt,
    updatedAt: material.updatedAt,
  };
}

export function toStockMovementResponse(movement: StockMovement) {
  return {
    id: movement.id,
    _id: movement.id,
    tenantId: movement.tenantId,
    materialId: movement.materialId,
    type: movement.type,
    quantity: movement.quantity,
    previousBalance: movement.previousBalance,
    newBalance: movement.newBalance,
    referenceType: movement.referenceType,
    referenceId: movement.referenceId,
    notes: movement.notes,
    createdAt: movement.createdAt,
  };
}

export function toPriceHistoryResponse(history: PriceHistory) {
  return {
    id: history.id,
    _id: history.id,
    tenantId: history.tenantId,
    materialId: history.materialId,
    date: history.date,
    ratePaise: history.ratePaise,
    source: history.source,
    createdAt: history.createdAt,
  };
}
