import { IEnquiryRepository, Enquiry } from "../interfaces/enquiry.repository.js";
import { ICounterRepository } from "../interfaces/counter.repository.js";
import { IAuditLogRepository } from "../interfaces/audit-log.js";
import { Actor } from "../utils/actor.js";
import { ListQuery, Page } from "../utils/pagination.js";
import { CreateEnquiryInput, UpdateEnquiryInput } from "../validators/enquiry.validator.js";
import { NotFoundError, BadRequestError } from "../errors/index.js";

export class EnquiryService {
  private fallbackCounter = 0;

  constructor(
    private readonly enquiries: IEnquiryRepository,
    private readonly counters?: ICounterRepository,
    private readonly audit?: IAuditLogRepository
  ) { }

  async list(actor: Actor, query?: ListQuery): Promise<Page<Enquiry>> {
    return this.enquiries.list(actor.tenantId, query);
  }

  async getById(actor: Actor, id: string): Promise<Enquiry> {
    const enquiry = await this.enquiries.findById(actor.tenantId, id);
    if (!enquiry) {
      throw new NotFoundError(`Enquiry with ID ${id} not found`);
    }
    return enquiry;
  }

  async create(actor: Actor, input: CreateEnquiryInput): Promise<Enquiry> {
    const enquiryNumber = this.counters
      ? await this.counters.getNextDocumentNumber(actor.tenantId, "enquiry", "ENQ")
      : `ENQ-${String(++this.fallbackCounter).padStart(5, "0")}`;

    const enquiry = await this.enquiries.create({
      tenantId: actor.tenantId,
      enquiryNumber,
      customerId: input.customerId,
      customerName: input.customerName,
      rawText: input.rawText,
      specs: input.specs,
      parsedRequirements: input.parsedRequirements,
      status: "new",
    });

    if (this.audit) {
      await this.audit.record({
        tenantId: actor.tenantId,
        userId: actor.userId,
        userRole: actor.role,
        action: "ENQUIRY_CREATED",
        entity: "enquiry",
        entityId: enquiry.id,
      });
    }

    return enquiry;
  }

  async update(
    actor: Actor,
    id: string,
    input: UpdateEnquiryInput
  ): Promise<Enquiry> {
    const existing = await this.enquiries.findById(actor.tenantId, id);
    if (!existing) {
      throw new NotFoundError(`Enquiry with ID ${id} not found`);
    }

    if (existing.status !== "new") {
      throw new BadRequestError(
        `Cannot update enquiry in '${existing.status}' status. Only enquiries in 'new' status can be modified.`
      );
    }

    const updated = await this.enquiries.update(actor.tenantId, id, {
      ...(input.rawText ? { rawText: input.rawText } : {}),
      ...(input.specs ? { specs: input.specs } : {}),
      ...(input.parsedRequirements ? { parsedRequirements: input.parsedRequirements as any } : {}),
    });

    if (this.audit) {
      await this.audit.record({
        tenantId: actor.tenantId,
        userId: actor.userId,
        userRole: actor.role,
        action: "ENQUIRY_UPDATED",
        entity: "enquiry",
        entityId: id,
        changes: { before: existing, after: updated },
      });
    }

    return updated!;
  }
}


