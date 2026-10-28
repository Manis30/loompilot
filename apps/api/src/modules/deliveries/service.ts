import { DeliveryModel, IDelivery } from "./model.js";
import { ProductionOrderModel } from "../orders/model.js";
import { OrderStatus } from "@loompilot/shared";

type DeliveryTrigger = (tenantId: string, delivery: IDelivery) => Promise<void>;
let onDeliveryRecorded: DeliveryTrigger | null = null;

export function registerDeliveryTrigger(trigger: DeliveryTrigger) {
  onDeliveryRecorded = trigger;
}

export class DeliveryService {
  static async list(tenantId: string): Promise<IDelivery[]> {
    return DeliveryModel.find({ tenantId }).sort({ createdAt: -1 });
  }

  static async getById(tenantId: string, id: string): Promise<IDelivery | null> {
    return DeliveryModel.findOne({ _id: id, tenantId });
  }

  static async recordDelivery(data: Partial<IDelivery> & { tenantId: string }): Promise<IDelivery> {
    const order = await ProductionOrderModel.findOne({ _id: data.orderId, tenantId: data.tenantId });
    if (!order) throw new Error("Order not found");

    const count = await DeliveryModel.countDocuments({ tenantId: data.tenantId });
    const deliveryNumber = `DEL-${String(count + 1).padStart(5, "0")}`;
    const invoiceNumber = `INV-${String(count + 1).padStart(5, "0")}`;

    // Determine isOnTime by comparing deliveryDate with targetDeliveryDate
    const deliveryDateStr = data.deliveryDate || new Date().toISOString().split("T")[0]!;
    const isOnTime = deliveryDateStr <= order.targetDeliveryDate;

    const delivery = await DeliveryModel.create({
      ...data,
      deliveryNumber: data.deliveryNumber || deliveryNumber,
      invoiceNumber: data.invoiceNumber || invoiceNumber,
      deliveryDate: deliveryDateStr,
      isOnTime,
    });

    // Mark production order as completed
    order.status = OrderStatus.COMPLETED;
    order.actualDeliveryDate = deliveryDateStr;
    await order.save();

    // Event Trigger (Amendment 2): Enqueue payment follow-up creation immediately!
    if (onDeliveryRecorded) {
      onDeliveryRecorded(data.tenantId, delivery).catch(() => {});
    }

    return delivery;
  }
}

