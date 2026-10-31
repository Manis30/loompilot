import { ClientRepository } from "../repositories/client.repository.js";
import { OrdersRepository } from "../repositories/orders.repository.js";
import { IClient } from "../models/identity/client.model.js";
import { PaginationQuery, PaginatedResult } from "../utils/pagination.js";
import { AuditService } from "./audit.service.js";
import { AppError } from "../errors/app-error.js";
import { ErrorCode } from "@loompilot/shared";

export function toClientDto(client: any): IClient {
  const obj = client.toObject ? client.toObject() : { ...client };
  if (obj.portalAccess) {
    delete obj.portalAccess.passwordHash;
    if (obj.portalAccess.lockout) {
      delete (obj.portalAccess.lockout as any).passwordHash;
    }
  }
  return obj as IClient;
}

export class ClientService {
  constructor(
    private readonly clientRepo = new ClientRepository(),
    private readonly auditService = new AuditService(),
    private readonly ordersRepo = new OrdersRepository()
  ) {}

  async listClients(
    tenantId: string,
    pagination: PaginationQuery,
    filterOptions?: {
      search?: string;
      status?: "active" | "inactive";
      customerType?: string;
      city?: string;
      country?: string;
      portalStatus?: "invited" | "active" | "locked";
    }
  ): Promise<PaginatedResult<IClient>> {
    const filter: Record<string, any> = {};

    if (filterOptions?.search) {
      const searchRegex = { $regex: filterOptions.search.trim(), $options: "i" };
      filter.$or = [
        { clientName: searchRegex },
        { contactPerson: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { city: searchRegex },
      ];
    }

    if (filterOptions?.status) {
      filter.status = filterOptions.status;
    }

    if (filterOptions?.customerType) {
      filter.customerType = { $regex: `^${filterOptions.customerType.trim()}$`, $options: "i" };
    }

    if (filterOptions?.city) {
      filter.city = { $regex: `^${filterOptions.city.trim()}$`, $options: "i" };
    }

    if (filterOptions?.country) {
      filter.country = { $regex: `^${filterOptions.country.trim()}$`, $options: "i" };
    }

    if (filterOptions?.portalStatus) {
      filter["portalAccess.status"] = filterOptions.portalStatus;
    }

    const result = await this.clientRepo.findPaginated(tenantId, filter, pagination);
    return {
      data: result.data.map(toClientDto),
      meta: result.meta,
    };
  }

  async getClientById(tenantId: string, id: string): Promise<IClient> {
    const client = await this.clientRepo.findById(tenantId, id);
    if (!client) {
      throw new AppError(ErrorCode.NOT_FOUND, `Client with id '${id}' not found`, 404);
    }
    return toClientDto(client);
  }

  async createClient(params: {
    tenantId: string;
    clientName: string;
    contactPerson?: string;
    email: string;
    phone?: string;
    city?: string;
    address?: string;
    customerType?: string;
    paymentTermsDays?: number;
    country?: string;
    status?: "active" | "inactive";
    actor: { id: string; email?: string; ip?: string; requestId?: string };
  }): Promise<IClient> {
    const { tenantId, actor, ...data } = params;

    const payload: Partial<IClient> = {
      clientName: data.clientName,
      contactPerson: data.contactPerson,
      email: data.email,
      phone: data.phone,
      city: data.city,
      address: data.address,
      customerType: data.customerType,
      paymentTermsDays: data.paymentTermsDays,
      country: data.country,
      status: data.status || "active",
      version: 1,
    };

    const created = await this.clientRepo.create(tenantId, payload);

    await this.auditService.log({
      tenantId,
      actor: { id: actor.id, type: "user", email: actor.email },
      action: "CLIENT_CREATED",
      entity: { collection: "clients", id: String(created._id) },
      after: { clientName: data.clientName, email: data.email, status: created.status },
      ip: actor.ip,
      requestId: actor.requestId,
    });

    return toClientDto(created);
  }

  async updateClient(params: {
    tenantId: string;
    id: string;
    updates: {
      clientName?: string;
      contactPerson?: string;
      email?: string;
      phone?: string;
      city?: string;
      address?: string;
      customerType?: string;
      paymentTermsDays?: number;
      country?: string;
      status?: "active" | "inactive";
    };
    actor: { id: string; email?: string; ip?: string; requestId?: string };
  }): Promise<IClient> {
    const { tenantId, id, updates, actor } = params;
    const before = await this.getClientById(tenantId, id);

    const payload: Partial<IClient> = {};
    if (updates.clientName !== undefined) payload.clientName = updates.clientName;
    if (updates.contactPerson !== undefined) payload.contactPerson = updates.contactPerson;
    if (updates.email !== undefined) payload.email = updates.email;
    if (updates.phone !== undefined) payload.phone = updates.phone;
    if (updates.city !== undefined) payload.city = updates.city;
    if (updates.address !== undefined) payload.address = updates.address;
    if (updates.customerType !== undefined) payload.customerType = updates.customerType;
    if (updates.paymentTermsDays !== undefined) payload.paymentTermsDays = updates.paymentTermsDays;
    if (updates.country !== undefined) payload.country = updates.country;
    if (updates.status !== undefined) payload.status = updates.status;

    const updated = await this.clientRepo.update(tenantId, id, payload);
    if (!updated) {
      throw new AppError(ErrorCode.NOT_FOUND, `Client '${id}' not found`, 404);
    }

    await this.auditService.log({
      tenantId,
      actor: { id: actor.id, type: "user", email: actor.email },
      action: "CLIENT_UPDATED",
      entity: { collection: "clients", id },
      before,
      after: updated,
      ip: actor.ip,
      requestId: actor.requestId,
    });

    return toClientDto(updated);
  }

  async deactivateClient(params: {
    tenantId: string;
    id: string;
    actor: { id: string; email?: string; ip?: string; requestId?: string };
  }): Promise<IClient> {
    const { tenantId, id, actor } = params;
    const before = await this.getClientById(tenantId, id);

    const historicalOrderCount = await this.ordersRepo.countByClientId(tenantId, id);

    const updated = await this.clientRepo.update(tenantId, id, { status: "inactive" });
    if (!updated) {
      throw new AppError(ErrorCode.NOT_FOUND, `Client '${id}' not found`, 404);
    }

    await this.auditService.log({
      tenantId,
      actor: { id: actor.id, type: "user", email: actor.email },
      action: "CLIENT_DEACTIVATED",
      entity: { collection: "clients", id },
      before,
      after: { status: "inactive", historicalOrderCount },
      ip: actor.ip,
      requestId: actor.requestId,
    });

    return toClientDto(updated);
  }

  async activateClient(params: {
    tenantId: string;
    id: string;
    actor: { id: string; email?: string; ip?: string; requestId?: string };
  }): Promise<IClient> {
    const { tenantId, id, actor } = params;
    const before = await this.getClientById(tenantId, id);

    const updated = await this.clientRepo.update(tenantId, id, { status: "active" });
    if (!updated) {
      throw new AppError(ErrorCode.NOT_FOUND, `Client '${id}' not found`, 404);
    }

    await this.auditService.log({
      tenantId,
      actor: { id: actor.id, type: "user", email: actor.email },
      action: "CLIENT_ACTIVATED",
      entity: { collection: "clients", id },
      before,
      after: { status: "active" },
      ip: actor.ip,
      requestId: actor.requestId,
    });

    return toClientDto(updated);
  }
}
