import { ProcessModel, IProcess } from "./model.js";

export class ProcessService {
  static async list(tenantId: string): Promise<IProcess[]> {
    return ProcessModel.find({ tenantId }).sort({ sequence: 1 });
  }

  static async getById(tenantId: string, id: string): Promise<IProcess | null> {
    return ProcessModel.findOne({ _id: id, tenantId });
  }

  static async create(data: Partial<IProcess> & { tenantId: string }): Promise<IProcess> {
    return ProcessModel.create(data);
  }
}

