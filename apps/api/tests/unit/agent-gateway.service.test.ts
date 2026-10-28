import { describe, it, expect, vi } from "vitest";
import { AgentGatewayService } from "../../src/services/agent-gateway.service.js";
import { Actor } from "../../src/utils/actor.js";
import { UserRole } from "@loompilot/shared";

describe("Unit: AgentGatewayService", () => {
  const actor: Actor = {
    userId: "agent_gateway",
    email: "agent@loompilot.internal",
    role: UserRole.OWNER,
    tenantId: "tenant_gw_unit",
  };

  it("delegates quotation draft ingestion to QuotationService", async () => {
    const mockQuotationService = {
      createDraft: vi.fn().mockResolvedValue({ id: "qt_test", status: "draft" }),
    } as any;
    const mockAlertService = {} as any;
    const mockPaymentService = {} as any;

    const service = new AgentGatewayService(
      mockQuotationService,
      mockAlertService,
      mockPaymentService
    );

    const draftData = { finalPricePaise: 100000 };
    const result = await service.ingestQuotationDraft(actor, draftData);

    expect(result.id).toBe("qt_test");
    expect(mockQuotationService.createDraft).toHaveBeenCalledWith(actor, draftData);
  });

  it("delegates alert ingestion to AlertService", async () => {
    const mockQuotationService = {} as any;
    const mockAlertService = {
      createAlert: vi.fn().mockResolvedValue({ id: "alt_test", title: "Deficit" }),
    } as any;
    const mockPaymentService = {} as any;

    const service = new AgentGatewayService(
      mockQuotationService,
      mockAlertService,
      mockPaymentService
    );

    const alertData = { title: "Deficit" };
    const result = await service.ingestAlert(actor, alertData);

    expect(result.id).toBe("alt_test");
    expect(mockAlertService.createAlert).toHaveBeenCalledWith(actor, alertData);
  });

  it("delegates recommendation ingestion to AlertService", async () => {
    const mockQuotationService = {} as any;
    const mockAlertService = {
      createRecommendation: vi.fn().mockResolvedValue({ id: "rec_test" }),
    } as any;
    const mockPaymentService = {} as any;

    const service = new AgentGatewayService(
      mockQuotationService,
      mockAlertService,
      mockPaymentService
    );

    const recData = { title: "Add worker" };
    const result = await service.ingestRecommendation(actor, recData);

    expect(result.id).toBe("rec_test");
    expect(mockAlertService.createRecommendation).toHaveBeenCalledWith(actor, recData);
  });

  it("records monitoring snapshots with timestamp", async () => {
    const service = new AgentGatewayService({} as any, {} as any, {} as any);
    const result = await service.recordMonitoringSnapshot(actor, { output: 50 });

    expect(result.status).toBe("recorded");
    expect(result.timestamp).toBeDefined();
  });

  it("delegates payment follow-up ingestion to PaymentService", async () => {
    const mockQuotationService = {} as any;
    const mockAlertService = {} as any;
    const mockPaymentService = {
      createFollowup: vi.fn().mockResolvedValue({ id: "pay_test" }),
    } as any;

    const service = new AgentGatewayService(
      mockQuotationService,
      mockAlertService,
      mockPaymentService
    );

    const followupData = { invoiceNumber: "INV-1" };
    const result = await service.ingestPaymentFollowup(actor, followupData);

    expect(result.id).toBe("pay_test");
    expect(mockPaymentService.createFollowup).toHaveBeenCalledWith(actor, followupData);
  });

  it("delegates reminder draft ingestion to PaymentService", async () => {
    const mockQuotationService = {} as any;
    const mockAlertService = {} as any;
    const mockPaymentService = {
      addReminderDraft: vi.fn().mockResolvedValue({ id: "pay_test" }),
    } as any;

    const service = new AgentGatewayService(
      mockQuotationService,
      mockAlertService,
      mockPaymentService
    );

    const draftData = { reminderNumber: 1 };
    const result = await service.ingestPaymentReminderDraft(actor, "pay_1", draftData);

    expect(result.id).toBe("pay_test");
    expect(mockPaymentService.addReminderDraft).toHaveBeenCalledWith(actor, "pay_1", draftData);
  });
});

