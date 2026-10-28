import {
  IReportRepository,
  QuotationSummary,
  DeliverySummary,
  PaymentSummary,
} from "../interfaces/report.repository.js";
import { QuotationModel } from "../models/quotation.model.js";
import { DeliveryModel } from "../models/delivery.model.js";
import { PaymentModel } from "../models/payment.model.js";
import { QuotationStatus } from "@loompilot/shared";

export class MongoReportRepository implements IReportRepository {
  async getConfirmedQuotations(tenantId: string): Promise<QuotationSummary[]> {
    const docs = await QuotationModel.find({
      tenantId,
      status: QuotationStatus.CONFIRMED,
    }).lean();

    return docs.map((q) => ({
      id: q._id.toString(),
      quotationNumber: q.quotationNumber,
      finalPricePaise: q.finalPricePaise,
      subtotalCostPaise: q.subtotalCostPaise,
      wastageCostPaise: q.wastageCostPaise,
      riskBufferCostPaise: q.riskBufferCostPaise,
    }));
  }

  async getDeliveries(tenantId: string): Promise<DeliverySummary[]> {
    const docs = await DeliveryModel.find({ tenantId }).lean();
    return docs.map((d) => ({
      id: d._id.toString(),
      isOnTime: d.isOnTime,
    }));
  }

  async getPayments(tenantId: string): Promise<PaymentSummary[]> {
    const docs = await PaymentModel.find({ tenantId }).lean();
    return docs.map((p) => ({
      id: p._id.toString(),
      totalInvoicePaise: p.totalInvoicePaise,
      amountReceivedPaise: p.amountReceivedPaise,
      balancePaise: p.balancePaise,
      dueDate: p.dueDate,
    }));
  }
}

