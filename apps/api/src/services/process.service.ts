import { IProcessRepository, Process } from "../interfaces/process.repository.js";
import { IAuditLogRepository } from "../interfaces/audit-log.js";
import { Actor } from "../utils/actor.js";
import { ListQuery, Page } from "../utils/pagination.js";
import { CreateProcessInput } from "../validators/process.validator.js";
import { NotFoundError, ConflictError } from "../errors/index.js";

export class ProcessService {
  constructor(
    private readonly repo: IProcessRepository,
    private readonly audit?: IAuditLogRepository
  ) {}

  async list(actor: Actor, query?: ListQuery): Promise<Page<Process>> {
    return this.repo.list(actor.tenantId, query);
  }

  async listAllOrdered(actor: Actor): Promise<Process[]> {
    return this.repo.listAllOrdered(actor.tenantId);
  }

  async getById(actor: Actor, id: string): Promise<Process> {
    const item = await this.repo.findById(actor.tenantId, id);
    if (!item) {
      throw new NotFoundError(`Process with ID ${id} not found`);
    }
    return item;
  }

  async create(actor: Actor, input: CreateProcessInput): Promise<Process> {
    const existing = await this.repo.findByName(actor.tenantId, input.name);
    if (existing) {
      throw new ConflictError(`Process ${input.name} already exists`);
    }

    const processItem = await this.repo.create({
      tenantId: actor.tenantId,
      name: input.name,
      sequence: input.sequence,
      standardWastagePct: input.standardWastagePct,
      avgOutputPerWorkerHour: input.avgOutputPerWorkerHour,
      unit: input.unit,
    });

    if (this.audit) {
      await this.audit.record({
        tenantId: actor.tenantId,
        actorId: actor.userId,
        actorRole: actor.role,
        action: "PROCESS_CREATED",
        entityType: "process",
        entityId: processItem.id,
        after: { name: processItem.name, sequence: processItem.sequence },
      });
    }

    return processItem;
  }

  async update(
    actor: Actor,
    id: string,
    updates: Partial<Process>
  ): Promise<Process> {
    const existing = await this.repo.findById(actor.tenantId, id);
    if (!existing) {
      throw new NotFoundError(`Process with ID ${id} not found`);
    }

    const updated = await this.repo.update(actor.tenantId, id, updates);
    if (!updated) {
      throw new NotFoundError(`Process with ID ${id} not found`);
    }

    if (this.audit) {
      await this.audit.record({
        tenantId: actor.tenantId,
        actorId: actor.userId,
        actorRole: actor.role,
        action: "PROCESS_UPDATED",
        entityType: "process",
        entityId: id,
        before: {
          sequence: existing.sequence,
          standardWastagePct: existing.standardWastagePct,
          costPerUnitPaise: existing.costPerUnitPaise,
          active: existing.active,
        },
        after: {
          sequence: updated.sequence,
          standardWastagePct: updated.standardWastagePct,
          costPerUnitPaise: updated.costPerUnitPaise,
          active: updated.active,
        },
      });
    }

    return updated;
  }
}

