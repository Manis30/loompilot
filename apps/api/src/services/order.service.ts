import {
  IOrderRepository,
  ProductionOrder,
  OrderVarianceReport,
} from "../interfaces/order.repository.js";
import { IWorkforceRepository } from "../interfaces/workforce.repository.js";
import { IUnitOfWork } from "../interfaces/unit-of-work.js";
import { IAuditLogRepository } from "../interfaces/audit-log.js";
import { Actor } from "../utils/actor.js";
import { ListQuery, Page } from "../utils/pagination.js";
import { NotFoundError } from "../errors/index.js";

export class OrderService {
  constructor(
    private readonly repo: IOrderRepository,
    private readonly workforceRepo: IWorkforceRepository,
    _uow?: IUnitOfWork,
    _audit?: IAuditLogRepository
  ) {}

  async list(actor: Actor, query?: ListQuery): Promise<Page<ProductionOrder>> {
    return this.repo.list(actor.tenantId, query);
  }

  async getById(actor: Actor, id: string): Promise<ProductionOrder> {
    const order = await this.repo.findById(actor.tenantId, id);
    if (!order) {
      throw new NotFoundError(`Order with ID ${id} not found`);
    }
    return order;
  }

  async getVariance(actor: Actor, orderId: string): Promise<OrderVarianceReport> {
    const order = await this.repo.findById(actor.tenantId, orderId);
    if (!order) {
      throw new NotFoundError(`Order with ID ${orderId} not found`);
    }

    const outputs = await this.workforceRepo.getOutputsForOrder(actor.tenantId, orderId);

    // Aggregate cumulative actual by date
    let cumulativeActual = 0;
    const outputMap = new Map<string, number>();

    for (const out of outputs) {
      cumulativeActual += out.quantityProduced;
      outputMap.set(out.date, cumulativeActual);
    }

    // Build timeline points from plan
    const varianceData = order.plan.map((step) => {
      const actualCumulative = outputMap.get(step.endDate) ?? cumulativeActual;
      const plannedTarget = step.targetQty;
      const deficit = Math.max(0, plannedTarget - actualCumulative);

      return {
        processName: step.processName,
        targetDate: step.endDate,
        plannedQty: plannedTarget,
        actualQty: actualCumulative,
        deficitQty: deficit,
        isBehind: actualCumulative < plannedTarget,
      };
    });

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      totalQuantity: order.totalQuantity,
      status: order.status,
      varianceData,
    };
  }
}
