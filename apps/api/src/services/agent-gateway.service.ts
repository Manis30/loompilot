import { QuotationService } from "./quotation.service.js";
import { AlertService } from "./alert.service.js";
import { PaymentService } from "./payment.service.js";
import { Actor } from "../utils/actor.js";
import { Quotation } from "../interfaces/quotation.repository.js";
import { Alert, Recommendation } from "../interfaces/alert.repository.js";
import { Payment } from "../interfaces/payment.repository.js";

export class AgentGatewayService {
  constructor(
    private readonly quotationService: QuotationService,
    private readonly alertService: AlertService,
    private readonly paymentService: PaymentService
  ) {}

  async ingestQuotationDraft(actor: Actor, data: any): Promise<Quotation> {
    return this.quotationService.createDraft(actor, data);
  }

  async ingestAlert(actor: Actor, data: any): Promise<Alert> {
    return this.alertService.createAlert(actor, data);
  }

  async ingestRecommendation(actor: Actor, data: any): Promise<Recommendation> {
    return this.alertService.createRecommendation(actor, data);
  }

  async recordMonitoringSnapshot(
    _actor: Actor,
    _data: any
  ): Promise<{ status: string; timestamp: string }> {
    return { status: "recorded", timestamp: new Date().toISOString() };
  }

  async ingestPaymentFollowup(actor: Actor, data: any): Promise<Payment> {
    return this.paymentService.createFollowup(actor, data);
  }

  async ingestPaymentReminderDraft(
    actor: Actor,
    paymentId: string,
    draft: any
  ): Promise<Payment> {
    return this.paymentService.addReminderDraft(actor, paymentId, draft);
  }
}
