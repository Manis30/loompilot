import { IEnquiryRepository, Enquiry } from "../interfaces/enquiry.repository.js";
import { IAuditLogRepository } from "../interfaces/audit-log.js";
import { Actor } from "../utils/actor.js";
import { ListQuery, Page } from "../utils/pagination.js";
import { CreateEnquiryInput } from "../validators/enquiry.validator.js";
import { NotFoundError } from "../errors/index.js";

export class EnquiryService {
  constructor(
    private readonly enquiries: IEnquiryRepository,
    private readonly audit?: IAuditLogRepository
  ) {}

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
    const currentCount = await this.enquiries.count(actor.tenantId);
    const enquiryNumber = `ENQ-${String(currentCount + 1).padStart(5, "0")}`;

    const enquiry = await this.enquiries.create({
      tenantId: actor.tenantId,
      enquiryNumber,
      customerId: input.customerId,
      customerName: input.customerName,
      rawText: input.rawText,
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
}
