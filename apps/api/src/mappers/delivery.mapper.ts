import { Delivery } from "../interfaces/delivery.repository.js";

export function toDeliveryResponse(delivery: Delivery) {
  return {
    id: delivery.id,
    _id: delivery.id,
    tenantId: delivery.tenantId,
    orderId: delivery.orderId,
    customerId: delivery.customerId,
    deliveryNumber: delivery.deliveryNumber,
    deliveredQuantity: delivery.deliveredQuantity,
    deliveryDate: delivery.deliveryDate,
    status: delivery.status,
    isOnTime: delivery.isOnTime,
    invoiceNumber: delivery.invoiceNumber,
    totalInvoicePaise: delivery.totalInvoicePaise,
    receivedBy: delivery.receivedBy,
    notes: delivery.notes,
    createdAt: delivery.createdAt,
    updatedAt: delivery.updatedAt,
  };
}
