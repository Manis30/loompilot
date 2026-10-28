import { CustomerModel, ICustomer } from "./model.js";

export class CustomerService {
  static async list(tenantId: string): Promise<ICustomer[]> {
    return CustomerModel.find({ tenantId }).sort({ name: 1 });
  }

  static async getById(tenantId: string, id: string): Promise<ICustomer | null> {
    return CustomerModel.findOne({ _id: id, tenantId });
  }

  static async create(data: Partial<ICustomer> & { tenantId: string }): Promise<ICustomer> {
    return CustomerModel.create(data);
  }
}
