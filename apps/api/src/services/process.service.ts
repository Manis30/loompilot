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
        userId: actor.userId,
        userRole: actor.role,
        action: "PROCESS_CREATED",
        entity: "process",
        entityId: processItem.id,
        changes: { name: processItem.name, sequence: processItem.sequence },
      });
    }

    return processItem;
  }
}

