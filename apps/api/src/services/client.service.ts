import { ClientRepository } from "../repositories/client.repository.js";
import { IClient } from "../models/identity/client.model.js";
import { PaginationQuery, PaginatedResult } from "../utils/pagination.js";
import { AuditService } from "./audit.service.js";
import { AppError } from "../errors/app-error.js";
import { ErrorCode } from "@loompilot/shared";

export class ClientService {
  constructor(
    private readonly clientRepo = new ClientRepository(),
    private readonly auditService = new AuditService()
  ) {}

  async listClients(
    tenantId: string,
    pagination: PaginationQuery,
    search?: string
  ): Promise<PaginatedResult<IClient>> {
    const filter: Record<string, any> = {};
    if (search) {
      filter.clientName = { $regex: search.trim(), $options: "i" };
    }

    const { page, limit, sortBy, sortOrder } = pagination;
    const all = await this.clientRepo.find(tenantId, filter);
    const total = all.length;

    // Apply sorting & in-memory pagination for repo
    const sortField = sortBy || "createdAt";
    const dir = sortOrder === "asc" ? 1 : -1;
    all.sort((a: any, b: any) => {
      if (a[sortField] < b[sortField]) return -1 * dir;
      if (a[sortField] > b[sortField]) return 1 * dir;
      return 0;
    });

    const items = all.slice((page - 1) * limit, page * limit);

    return {
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async getClientById(tenantId: string, id: string): Promise<IClient> {
    const client = await this.clientRepo.findById(tenantId, id);
    if (!client) {
      throw new AppError(ErrorCode.NOT_FOUND, `Client with id '${id}' not found`, 404);
    }
    return client;
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
    actor: { id: string; email?: string; ip?: string; requestId?: string };
  }): Promise<IClient> {
    const { tenantId, actor, ...data } = params;

    const created = await this.clientRepo.create(tenantId, {
      ...data,
      status: "active",
    });

    await this.auditService.log({
      tenantId,
      actor: { id: actor.id, type: "user", email: actor.email },
      action: "CLIENT_CREATED",
      entity: { collection: "clients", id: String(created._id) },
      after: { clientName: data.clientName, email: data.email },
      ip: actor.ip,
      requestId: actor.requestId,
    });

    return created;
  }

  async updateClient(params: {
    tenantId: string;
    id: string;
    updates: Partial<IClient>;
    actor: { id: string; email?: string; ip?: string; requestId?: string };
  }): Promise<IClient> {
    const { tenantId, id, updates, actor } = params;
    const before = await this.getClientById(tenantId, id);

    const updated = await this.clientRepo.update(tenantId, id, updates);
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

    return updated;
  }

  async deactivateClient(params: {
    tenantId: string;
    id: string;
    actor: { id: string; email?: string; ip?: string; requestId?: string };
  }): Promise<IClient> {
    return this.updateClient({
      tenantId: params.tenantId,
      id: params.id,
      updates: { status: "inactive" },
      actor: params.actor,
    });
  }
}
