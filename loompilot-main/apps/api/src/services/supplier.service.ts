import { SupplierRepository } from "../repositories/supplier.repository.js";
import { ISupplier } from "../models/identity/supplier.model.js";
import { PaginationQuery, PaginatedResult } from "../utils/pagination.js";
import { AuditService } from "./audit.service.js";
import { AppError } from "../errors/app-error.js";
import { ErrorCode } from "@loompilot/shared";

export class SupplierService {
  constructor(
    private readonly supplierRepo = new SupplierRepository(),
    private readonly auditService = new AuditService()
  ) {}

  async listSuppliers(
    tenantId: string,
    pagination: PaginationQuery,
    search?: string
  ): Promise<PaginatedResult<ISupplier>> {
    const filter: Record<string, any> = {};
    if (search) {
      filter.supplierName = { $regex: search.trim(), $options: "i" };
    }
    return this.supplierRepo.findPaginated(tenantId, filter, pagination);
  }

  async getSupplierById(tenantId: string, id: string): Promise<ISupplier> {
    const supplier = await this.supplierRepo.findById(tenantId, id);
    if (!supplier) {
      throw new AppError(ErrorCode.NOT_FOUND, `Supplier with id '${id}' not found`, 404);
    }
    return supplier;
  }

  async createSupplier(params: {
    tenantId: string;
    supplierName: string;
    contactPerson?: string;
    email: string;
    phone: string;
    city: string;
    country?: string;
    defaultLeadTimeDays?: number;
    actor: { id: string; email?: string; ip?: string; requestId?: string };
  }): Promise<ISupplier> {
    const { tenantId, actor, ...data } = params;

    const created = await this.supplierRepo.create(tenantId, {
      ...data,
      status: "active",
      version: 1,
    });

    await this.auditService.log({
      tenantId,
      actor: { id: actor.id, type: "user", email: actor.email },
      action: "SUPPLIER_CREATED",
      entity: { collection: "suppliers", id: String(created._id) },
      after: { supplierName: data.supplierName, phone: data.phone },
      ip: actor.ip,
      requestId: actor.requestId,
    });

    return created;
  }

  async updateSupplier(params: {
    tenantId: string;
    id: string;
    updates: Partial<ISupplier>;
    actor: { id: string; email?: string; ip?: string; requestId?: string };
  }): Promise<ISupplier> {
    const { tenantId, id, updates, actor } = params;
    const before = await this.getSupplierById(tenantId, id);

    const updated = await this.supplierRepo.update(tenantId, id, updates);
    if (!updated) {
      throw new AppError(ErrorCode.NOT_FOUND, `Supplier '${id}' not found`, 404);
    }

    await this.auditService.log({
      tenantId,
      actor: { id: actor.id, type: "user", email: actor.email },
      action: "SUPPLIER_UPDATED",
      entity: { collection: "suppliers", id },
      before,
      after: updated,
      ip: actor.ip,
      requestId: actor.requestId,
    });

    return updated;
  }

  async deactivateSupplier(params: {
    tenantId: string;
    id: string;
    actor: { id: string; email?: string; ip?: string; requestId?: string };
  }): Promise<ISupplier> {
    return this.updateSupplier({
      tenantId: params.tenantId,
      id: params.id,
      updates: { status: "inactive" },
      actor: params.actor,
    });
  }
}

