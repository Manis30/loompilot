import { MaterialRepository } from "../repositories/material.repository.js";
import { MarketPriceRepository } from "../repositories/market-price.repository.js";
import { IMaterial } from "../models/catalog/material.model.js";
import { PaginationQuery, PaginatedResult } from "../utils/pagination.js";
import { AuditService } from "./audit.service.js";
import { AppError } from "../errors/app-error.js";
import { ErrorCode } from "@loompilot/shared";
import { getTodayBusinessDate } from "../utils/dates.js";

export class MaterialService {
  constructor(
    private readonly materialRepo = new MaterialRepository(),
    private readonly marketPriceRepo = new MarketPriceRepository(),
    private readonly auditService = new AuditService()
  ) {}

  async listMaterials(
    tenantId: string,
    pagination: PaginationQuery,
    filterParams?: { type?: string; watchlist?: boolean; search?: string }
  ): Promise<PaginatedResult<IMaterial>> {
    const filter: Record<string, any> = {};
    if (filterParams?.type) {
      filter.type = filterParams.type;
    }
    if (filterParams?.watchlist !== undefined) {
      filter.watchlist = filterParams.watchlist;
    }
    if (filterParams?.search) {
      filter.materialName = { $regex: filterParams.search.trim(), $options: "i" };
    }
    return this.materialRepo.findPaginated(tenantId, filter, pagination);
  }

  async getMaterialById(tenantId: string, id: string): Promise<IMaterial> {
    const material = await this.materialRepo.findById(tenantId, id);
    if (!material) {
      throw new AppError(ErrorCode.NOT_FOUND, `Material with id '${id}' not found`, 404);
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

    const created = await this.materialRepo.createMaterial(tenantId, data);

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

  async deleteMaterial(params: {
    tenantId: string;
    id: string;
    actor: { id: string; email?: string; ip?: string; requestId?: string };
  }): Promise<void> {
    const { tenantId, id, actor } = params;
    const before = await this.getMaterialById(tenantId, id);

    await this.materialRepo.delete(tenantId, id);

    await this.auditService.log({
      tenantId,
      actor: { id: actor.id, type: "user", email: actor.email },
      action: "MATERIAL_DELETED",
      entity: { collection: "materials", id },
      before,
      ip: actor.ip,
      requestId: actor.requestId,
    });
  }
}
