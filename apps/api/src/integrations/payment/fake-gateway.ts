import crypto from "node:crypto";
import {
  IPaymentGateway,
  CreatePaymentOrderParams,
  PaymentOrderResult,
  VerifyPaymentSignatureParams,
  PaymentWebhookEvent,
} from "../../interfaces/payment-gateway.interface.js";

export class FakeGateway implements IPaymentGateway {
  async createOrder(params: CreatePaymentOrderParams): Promise<PaymentOrderResult> {
    const fakeOrderId = `order_fake_${crypto.randomBytes(8).toString("hex")}`;
    return {
      gatewayOrderId: fakeOrderId,
      amountPaise: params.amountPaise,
      currency: params.currency || "INR",
      status: "created",
    };
  }

  verifySignature(params: VerifyPaymentSignatureParams): boolean {
    if (!params.signature) return false;
    // Accept valid fake signatures
    return (
      params.signature.startsWith("fake_") ||
      params.gatewayOrderId.startsWith("order_fake_") ||
      params.signature === "valid_signature"
    );
  }

  parseWebhook(payload: any, _signatureHeader?: string): PaymentWebhookEvent {
    // If payload is already parsed JSON or string
    const event = typeof payload === "string" ? JSON.parse(payload) : payload;
    const paymentEntity = event?.payload?.payment?.entity || event;

    return {
      eventType: event?.event || "payment.captured",
      gatewayOrderId: paymentEntity?.order_id || `order_fake_${crypto.randomBytes(4).toString("hex")}`,
      paymentId: paymentEntity?.id || `pay_fake_${crypto.randomBytes(4).toString("hex")}`,
      amountPaise: paymentEntity?.amount || 0,
      currency: paymentEntity?.currency || "INR",
      notes: paymentEntity?.notes || {},
      rawEvent: event,
    };
  }
}

