import { SupplierModel, ISupplier } from "./model.js";

export class SupplierService {
  static async list(tenantId: string): Promise<ISupplier[]> {
    return SupplierModel.find({ tenantId }).sort({ name: 1 });
  }

  static async getById(tenantId: string, id: string): Promise<ISupplier | null> {
    return SupplierModel.findOne({ _id: id, tenantId });
  }

  static async create(data: Partial<ISupplier> & { tenantId: string }): Promise<ISupplier> {
    return SupplierModel.create(data);
  }
}

