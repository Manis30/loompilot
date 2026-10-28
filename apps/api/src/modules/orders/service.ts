import { ProductionOrderModel, IProductionOrder } from "./model.js";
import { DailyOutputModel } from "../workforce/model.js";

export class OrderService {
  static async list(tenantId: string): Promise<IProductionOrder[]> {
    return ProductionOrderModel.find({ tenantId }).sort({ createdAt: -1 });
  }

  static async getById(tenantId: string, id: string): Promise<IProductionOrder | null> {
    return ProductionOrderModel.findOne({ _id: id, tenantId });
  }

  static async getVariance(tenantId: string, orderId: string): Promise<any> {
    const order = await ProductionOrderModel.findOne({ _id: orderId, tenantId });
    if (!order) throw new Error("Order not found");

    const outputs = await DailyOutputModel.find({ tenantId, orderId }).sort({ date: 1 });

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
      orderId: order._id,
      orderNumber: order.orderNumber,
      totalQuantity: order.totalQuantity,
      status: order.status,
      varianceData,
    };
  }
}
