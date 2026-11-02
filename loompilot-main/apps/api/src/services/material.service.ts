import { MaterialRepository } from "../repositories/material.repository.js";
import { SupplierRepository } from "../repositories/supplier.repository.js";
import { MarketPriceRepository } from "../repositories/market-price.repository.js";
import { IMaterial } from "../models/catalog/material.model.js";
import { PaginationQuery, PaginatedResult } from "../utils/pagination.js";
import { AuditService } from "./audit.service.js";
import { AppError } from "../errors/app-error.js";
import { ErrorCode } from "@loompilot/shared";
import { getTodayBusinessDate } from "../utils/dates.js";

export interface SupervisorMaterialDto {
  id: string;
  materialName: string;
  type: string;
  unit?: string;
  stockQty: number;
  reservedQty: number;
  reorderLevel: number;
  available: number;
  status: string;
}

export function toSupervisorMaterialDto(m: any): SupervisorMaterialDto {
  return {
    id: String(m._id),
    materialName: m.materialName,
    type: m.type,
    unit: m.unit,
    stockQty: m.stockQty ?? 0,
    reservedQty: m.reservedQty ?? 0,
    reorderLevel: m.reorderLevel ?? 0,
    available: Math.max(0, (m.stockQty ?? 0) - (m.reservedQty ?? 0)),
    status: m.status ?? "active",
  };
}

export class MaterialService {
  constructor(
    private readonly materialRepo = new MaterialRepository(),
    private readonly supplierRepo = new SupplierRepository(),
    private readonly marketPriceRepo = new MarketPriceRepository(),
    private readonly auditService = new AuditService()
  ) {}

  async listMaterials(
    tenantId: string,
    pagination: PaginationQuery,
    filterParams?: { type?: string; watchlist?: boolean; search?: string; status?: string },
    isSupervisor = false
  ): Promise<PaginatedResult<any>> {
    const filter: Record<string, any> = {};
    if (filterParams?.type) {
      filter.type = filterParams.type;
    }
    if (filterParams?.watchlist !== undefined) {
      filter.watchlist = filterParams.watchlist;
    }
    if (filterParams?.status) {
      filter.status = filterParams.status;
    }
    if (filterParams?.search) {
      filter.materialName = { $regex: filterParams.search.trim(), $options: "i" };
    }

    const paginated = await this.materialRepo.findPaginated(tenantId, filter, pagination);

    if (isSupervisor) {
      return {
        data: paginated.data.map(toSupervisorMaterialDto),
        meta: paginated.meta,
      };
    }

    return paginated;
  }

  async getMaterialById(tenantId: string, id: string, isSupervisor = false): Promise<any> {
    const material = await this.materialRepo.findById(tenantId, id);
    if (!material) {
      throw new AppError(ErrorCode.NOT_FOUND, `Material with id '${id}' not found`, 404);
    }
    if (isSupervisor) {
      return toSupervisorMaterialDto(material);
    }
    return material;
  }

  async createMaterial(params: {
    tenantId: string;
    materialName: string;
    type: "yarn" | "fabric" | "dye_chemical" | "trim" | "packing";
    stockQty?: number;
    reorderLevel?: number;
    currentRatePaise: number;
    preferredSupplierId?: string;
    unit?: string;
    watchlist?: boolean;
    actor: { id: string; email?: string; ip?: string; requestId?: string };
  }): Promise<IMaterial> {
    const { tenantId, actor, ...data } = params;

    if (data.preferredSupplierId) {
      const supplier = await this.supplierRepo.findById(tenantId, data.preferredSupplierId);
      if (!supplier || supplier.status === "inactive") {
        throw new AppError(ErrorCode.VALIDATION_FAILED, "Preferred supplier does not exist or is inactive", 400);
      }
    }

    const created = await this.materialRepo.createMaterial(tenantId, {
      ...data,
      status: "active",
    } as any);

    await this.auditService.log({
      tenantId,
      actor: { id: actor.id, type: "user", email: actor.email },
      action: "MATERIAL_CREATED",
      entity: { collection: "materials", id: String(created._id) },
      after: { materialName: data.materialName, currentRatePaise: data.currentRatePaise },
      ip: actor.ip,
      requestId: actor.requestId,
    });

    return created;
  }

  async updateMaterial(params: {
    tenantId: string;
    id: string;
    updates: Partial<IMaterial>;
    actor: { id: string; email?: string; ip?: string; requestId?: string };
  }): Promise<IMaterial> {
    const { tenantId, id, updates, actor } = params;
    const before = await this.getMaterialById(tenantId, id);

    if (updates.preferredSupplierId) {
      const supplier = await this.supplierRepo.findById(tenantId, String(updates.preferredSupplierId));
      if (!supplier || supplier.status === "inactive") {
        throw new AppError(ErrorCode.VALIDATION_FAILED, "Preferred supplier does not exist or is inactive", 400);
      }
    }

    const updated = await this.materialRepo.update(tenantId, id, updates as any);
    if (!updated) {
      throw new AppError(ErrorCode.NOT_FOUND, `Material '${id}' not found`, 404);
    }

    await this.auditService.log({
      tenantId,
      actor: { id: actor.id, type: "user", email: actor.email },
      action: "MATERIAL_UPDATED",
      entity: { collection: "materials", id },
      before,
      after: updated,
      ip: actor.ip,
      requestId: actor.requestId,
    });

    return updated;
  }

  async updateRate(params: {
    tenantId: string;
    id: string;
    currentRatePaise: number;
    actor: { id: string; email?: string; ip?: string; requestId?: string };
  }): Promise<IMaterial> {
    const { tenantId, id, currentRatePaise, actor } = params;
    const before = await this.getMaterialById(tenantId, id);

    const updated = await this.materialRepo.updateRate(tenantId, id, currentRatePaise);
    if (!updated) {
      throw new AppError(ErrorCode.NOT_FOUND, `Material '${id}' not found`, 404);
    }

    // Append a trusted supplier_quote observation in marketPrices
    const today = getTodayBusinessDate();
    await this.marketPriceRepo.appendObservation(tenantId, id, today, {
      source: "supplier_quote",
      sourceType: "supplier_quote",
      unitPricePaise: currentRatePaise,
      trust: "trusted",
      verificationStatus: "verified",
    });

    await this.auditService.log({
      tenantId,
      actor: { id: actor.id, type: "user", email: actor.email },
      action: "MATERIAL_RATE_UPDATED",
      entity: { collection: "materials", id },
      before: { currentRatePaise: before.currentRatePaise },
      after: { currentRatePaise: updated.currentRatePaise },
      ip: actor.ip,
      requestId: actor.requestId,
    });

    return updated;
  }

  async updateSupplierOffers(params: {
    tenantId: string;
    id: string;
    offers: Array<{ supplierId: string; ratePaise: number; leadDays: number }>;
    actor: { id: string; email?: string; ip?: string; requestId?: string };
  }): Promise<IMaterial> {
    const { tenantId, id, offers, actor } = params;
    await this.getMaterialById(tenantId, id);

    // Verify all offered suppliers exist and are active
    for (const o of offers) {
      const supplier = await this.supplierRepo.findById(tenantId, o.supplierId);
      if (!supplier || supplier.status === "inactive") {
        throw new AppError(ErrorCode.VALIDATION_FAILED, `Supplier '${o.supplierId}' in offers is inactive or not found`, 400);
      }
    }

    const updated = await this.materialRepo.updateOffers(tenantId, id, offers);
    if (!updated) {
      throw new AppError(ErrorCode.NOT_FOUND, `Material '${id}' not found`, 404);
    }

    await this.auditService.log({
      tenantId,
      actor: { id: actor.id, type: "user", email: actor.email },
      action: "MATERIAL_OFFERS_UPDATED",
      entity: { collection: "materials", id },
      after: { offersCount: offers.length },
      ip: actor.ip,
      requestId: actor.requestId,
    });

    return updated;
  }

  async deactivateMaterial(params: {
    tenantId: string;
    id: string;
    actor: { id: string; email?: string; ip?: string; requestId?: string };
  }): Promise<IMaterial> {
    const { tenantId, id, actor } = params;
    const before = await this.getMaterialById(tenantId, id);

    const updated = await this.materialRepo.update(tenantId, id, { status: "inactive" });
    if (!updated) {
      throw new AppError(ErrorCode.NOT_FOUND, `Material '${id}' not found`, 404);
    }

    await this.auditService.log({
      tenantId,
      actor: { id: actor.id, type: "user", email: actor.email },
      action: "MATERIAL_DEACTIVATED",
      entity: { collection: "materials", id },
      before,
      after: updated,
      ip: actor.ip,
      requestId: actor.requestId,
    });

    return updated;
  }
}
