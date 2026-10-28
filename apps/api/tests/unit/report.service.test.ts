import { describe, it, expect, beforeEach } from "vitest";
import { ReportService } from "../../src/services/report.service.js";
import {
  IReportRepository,
  QuotationSummary,
  DeliverySummary,
  PaymentSummary,
} from "../../src/interfaces/report.repository.js";
import { Actor } from "../../src/utils/actor.js";
import { UserRole } from "@loompilot/shared";

class FakeReportRepository implements IReportRepository {
  public quotations: QuotationSummary[] = [];
  public deliveries: DeliverySummary[] = [];
  public payments: PaymentSummary[] = [];

  async getConfirmedQuotations(_tenantId: string): Promise<QuotationSummary[]> {
    return this.quotations;
  }

  async getDeliveries(_tenantId: string): Promise<DeliverySummary[]> {
    return this.deliveries;
  }

  async getPayments(_tenantId: string): Promise<PaymentSummary[]> {
    return this.payments;
  }
}

describe("Unit: ReportService", () => {
  let fakeRepo: FakeReportRepository;
  let service: ReportService;

  const actor: Actor = {
    userId: "usr_owner",
    email: "owner@loompilot.test",
    role: UserRole.OWNER,
    tenantId: "tenant_rep_unit",
  };

  beforeEach(() => {
    fakeRepo = new FakeReportRepository();
    service = new ReportService(fakeRepo);
  });

  describe("Margin Report", () => {
    it("computes revenue, total costs, gross margin and breakdown correctly", async () => {
      fakeRepo.quotations = [
        {
          id: "qt_1",
          quotationNumber: "QT-00001",
          finalPricePaise: 100000,
          subtotalCostPaise: 60000,
          wastageCostPaise: 5000,
          riskBufferCostPaise: 5000,
        },
        {
          id: "qt_2",
          quotationNumber: "QT-00002",
          finalPricePaise: 200000,
          subtotalCostPaise: 120000,
          wastageCostPaise: 10000,
          riskBufferCostPaise: 10000,
        },
      ];

      const report = await service.getMarginReport(actor);

      expect(report.tenantId).toBe(actor.tenantId);
      expect(report.totalRevenuePaise).toBe(300000);
      expect(report.totalCostPaise).toBe(210000); // (60+5+5) + (120+10+10) = 70 + 140 = 210
      expect(report.grossMarginPaise).toBe(90000); // 300000 - 210000
      expect(report.grossMarginPct).toBe(30); // 90000 / 300000 = 30%
      expect(report.orderBreakdown).toHaveLength(2);
      expect(report.orderBreakdown[0].marginPct).toBe(30);
    });

    it("handles empty confirmed quotations gracefully without dividing by zero", async () => {
      fakeRepo.quotations = [];
      const report = await service.getMarginReport(actor);
      expect(report.totalRevenuePaise).toBe(0);
      expect(report.grossMarginPct).toBe(0);
      expect(report.orderBreakdown).toHaveLength(0);
    });
  });

  describe("On-Time Report", () => {
    it("calculates on-time delivery rate correctly", async () => {
      fakeRepo.deliveries = [
        { id: "del_1", isOnTime: true },
        { id: "del_2", isOnTime: true },
        { id: "del_3", isOnTime: false },
        { id: "del_4", isOnTime: true },
      ];

      const report = await service.getOnTimeReport(actor);

      expect(report.totalDeliveries).toBe(4);
      expect(report.onTimeDeliveries).toBe(3);
      expect(report.lateDeliveries).toBe(1);
      expect(report.onTimeRatePct).toBe(75); // 3 / 4 = 75%
      expect(report.averageDelayDays).toBe(3.5);
    });

    it("defaults on-time rate to 100% when no deliveries have occurred", async () => {
      fakeRepo.deliveries = [];
      const report = await service.getOnTimeReport(actor);
      expect(report.totalDeliveries).toBe(0);
      expect(report.onTimeRatePct).toBe(100);
      expect(report.averageDelayDays).toBe(0);
    });
  });

  describe("Collections Report", () => {
    it("aggregates invoiced, collected, outstanding, and overdue balances", async () => {
      const pastDate = "2020-01-01";
      const futureDate = "2030-01-01";

      fakeRepo.payments = [
        {
          id: "pay_1",
          totalInvoicePaise: 100000,
          amountReceivedPaise: 100000,
          balancePaise: 0,
          dueDate: pastDate,
        },
        {
          id: "pay_2",
          totalInvoicePaise: 150000,
          amountReceivedPaise: 50000,
          balancePaise: 100000,
          dueDate: pastDate, // Overdue
        },
        {
          id: "pay_3",
          totalInvoicePaise: 200000,
          amountReceivedPaise: 0,
          balancePaise: 200000,
          dueDate: futureDate, // Current
        },
      ];

      const report = await service.getCollectionsReport(actor);

      expect(report.totalInvoicedPaise).toBe(450000);
      expect(report.totalCollectedPaise).toBe(150000);
      expect(report.totalOutstandingPaise).toBe(300000);
      expect(report.totalOverduePaise).toBe(100000);
      expect(report.agingSummary.currentPaise).toBe(200000);
      expect(report.agingSummary.days1To30Paise).toBe(100000);
    });
  });
});
