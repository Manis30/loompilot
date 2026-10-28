import {
  ProductionOrder,
  OrderVarianceReport,
} from "../interfaces/order.repository.js";

export function toOrderResponse(order: ProductionOrder) {
  return {
    id: order.id,
    _id: order.id,
    tenantId: order.tenantId,
    quotationId: order.quotationId,
    customerId: order.customerId,
    orderNumber: order.orderNumber,
    productName: order.productName,
    totalQuantity: order.totalQuantity,
    unit: order.unit,
    status: order.status,
    startDate: order.startDate,
    targetDeliveryDate: order.targetDeliveryDate,
    actualDeliveryDate: order.actualDeliveryDate,
    plan: order.plan,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export function toVarianceResponse(report: OrderVarianceReport) {
  return {
    orderId: report.orderId,
    orderNumber: report.orderNumber,
    totalQuantity: report.totalQuantity,
    status: report.status,
    varianceData: report.varianceData,
  };
}

