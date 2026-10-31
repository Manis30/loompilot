import { AdminCostingRepository } from "../../repositories/admin-costing.repository.js";
import { ICosting } from "../../models/orders/order.model.js";

export class AdminCostingService {
  constructor(private readonly adminCostingRepo = new AdminCostingRepository()) {}

  async getCosting(tenantId: string, orderId: string): Promise<ICosting | null> {
    return this.adminCostingRepo.getCosting(tenantId, orderId);
  }

  async updateCosting(tenantId: string, orderId: string, costing: any): Promise<ICosting> {
    return this.adminCostingRepo.updateCosting(tenantId, orderId, costing);
  }
}
