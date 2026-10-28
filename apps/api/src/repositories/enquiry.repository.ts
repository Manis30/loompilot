import {
  IEnquiryRepository,
  Enquiry,
  NewEnquiry,
} from "../interfaces/enquiry.repository.js";
import { TxContext } from "../interfaces/unit-of-work.js";
import { ListQuery, Page, toPage } from "../utils/pagination.js";
import { EnquiryModel } from "../models/enquiry.model.js";

export class MongoEnquiryRepository implements IEnquiryRepository {
  private toEntity(doc: any): Enquiry {
    return {
      id: doc._id.toString(),
      tenantId: doc.tenantId,
      enquiryNumber: doc.enquiryNumber,
      customerId: doc.customerId,
      customerName: doc.customerName,
      rawText: doc.rawText,
      parsedRequirements: doc.parsedRequirements,
      status: doc.status,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async create(data: NewEnquiry, tx?: TxContext): Promise<Enquiry> {
    const docs = await EnquiryModel.create([data], { session: tx?.session || null });
    return this.toEntity(docs[0]!);
  }

  async findById(tenantId: string, id: string): Promise<Enquiry | null> {
    const doc = await EnquiryModel.findOne({ _id: id, tenantId }).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async findByNumber(tenantId: string, enquiryNumber: string): Promise<Enquiry | null> {
    const doc = await EnquiryModel.findOne({ tenantId, enquiryNumber }).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async list(tenantId: string, query?: ListQuery): Promise<Page<Enquiry>> {
    const page = query?.page || 1;
    const limit = query?.limit || 50;
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      EnquiryModel.find({ tenantId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      EnquiryModel.countDocuments({ tenantId }),
    ]);

    return toPage(docs.map((d) => this.toEntity(d)), total, page, limit);
  }

  async count(tenantId: string): Promise<number> {
    return EnquiryModel.countDocuments({ tenantId });
  }

  async updateStatus(
    tenantId: string,
    id: string,
    status: Enquiry["status"],
    tx?: TxContext
  ): Promise<Enquiry | null> {
    const doc = await EnquiryModel.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: { status } },
      { new: true, session: tx?.session || null }
    ).lean();
    return doc ? this.toEntity(doc) : null;
  }
}
