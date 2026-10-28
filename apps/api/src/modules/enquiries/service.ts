import { EnquiryModel, IEnquiry } from "./model.js";

export class EnquiryService {
  static async list(tenantId: string): Promise<IEnquiry[]> {
    return EnquiryModel.find({ tenantId }).sort({ createdAt: -1 });
  }

  static async getById(tenantId: string, id: string): Promise<IEnquiry | null> {
    return EnquiryModel.findOne({ _id: id, tenantId });
  }

  static async create(data: Partial<IEnquiry> & { tenantId: string }): Promise<IEnquiry> {
    const count = await EnquiryModel.countDocuments({ tenantId: data.tenantId });
    const enquiryNumber = `ENQ-${String(count + 1).padStart(5, "0")}`;
    return EnquiryModel.create({
      ...data,
      enquiryNumber: data.enquiryNumber || enquiryNumber,
    });
  }
}
