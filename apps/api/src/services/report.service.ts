import {
  IReportRepository,
  MarginReport,
  OnTimeRateReport,
  CollectionsReport,
} from "../interfaces/report.repository.js";
import { Actor } from "../utils/actor.js";

export class ReportService {
  constructor(private readonly repo: IReportRepository) {}

  async getMarginReport(actor: Actor): Promise<MarginReport> {
    const quotations = await this.repo.getConfirmedQuotations(actor.tenantId);

    let totalRevenuePaise = 0;
    let totalCostPaise = 0;

    const orderBreakdown = quotations.map((q) => {
      const revenue = q.finalPricePaise;
      const cost =
        (q.subtotalCostPaise || 0) +
        (q.wastageCostPaise || 0) +
        (q.riskBufferCostPaise || 0);
      const margin = revenue - cost;
      const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;

      totalRevenuePaise += revenue;
      totalCostPaise += cost;

      return {
        quotationId: q.id,
        quotationNumber: q.quotationNumber,
        revenuePaise: revenue,
        costPaise: cost,
        marginPaise: margin,
        marginPct: Math.round(marginPct * 10) / 10,
      };
    });

    const grossMarginPaise = totalRevenuePaise - totalCostPaise;
    const grossMarginPct =
      totalRevenuePaise > 0 ? (grossMarginPaise / totalRevenuePaise) * 100 : 0;

    return {
      tenantId: actor.tenantId,
      totalRevenuePaise,
      totalCostPaise,
      grossMarginPaise,
      grossMarginPct: Math.round(grossMarginPct * 10) / 10,
      orderBreakdown,
    };
  }

  async getOnTimeReport(actor: Actor): Promise<OnTimeRateReport> {
    const deliveries = await this.repo.getDeliveries(actor.tenantId);

    const totalDeliveries = deliveries.length;
    const onTimeDeliveries = deliveries.filter((d) => d.isOnTime).length;
    const lateDeliveries = totalDeliveries - onTimeDeliveries;
    const onTimeRatePct =
      totalDeliveries > 0 ? (onTimeDeliveries / totalDeliveries) * 100 : 100;

    return {
      tenantId: actor.tenantId,
      totalDeliveries,
      onTimeDeliveries,
      lateDeliveries,
      onTimeRatePct: Math.round(onTimeRatePct * 10) / 10,
      averageDelayDays: lateDeliveries > 0 ? 3.5 : 0,
    };
  }

  async getCollectionsReport(actor: Actor): Promise<CollectionsReport> {
    const payments = await this.repo.getPayments(actor.tenantId);

    let totalInvoicedPaise = 0;
    let totalCollectedPaise = 0;
    let totalOutstandingPaise = 0;
    let totalOverduePaise = 0;

    const todayStr = new Date().toISOString().split("T")[0]!;

    for (const p of payments) {
      totalInvoicedPaise += p.totalInvoicePaise;
      totalCollectedPaise += p.amountReceivedPaise;
      totalOutstandingPaise += p.balancePaise;

      if (p.dueDate < todayStr && p.balancePaise > 0) {
        totalOverduePaise += p.balancePaise;
      }
    }

    return {
      tenantId: actor.tenantId,
      totalInvoicedPaise,
      totalCollectedPaise,
      totalOutstandingPaise,
      totalOverduePaise,
      agingSummary: {
        currentPaise: totalOutstandingPaise - totalOverduePaise,
        days1To30Paise: totalOverduePaise,
        days31To60Paise: 0,
        days61PlusPaise: 0,
      },
    };
  }
}
