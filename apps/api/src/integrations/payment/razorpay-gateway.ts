import crypto from "node:crypto";
import {
  IPaymentGateway,
  CreatePaymentOrderParams,
  PaymentOrderResult,
  VerifyPaymentSignatureParams,
  PaymentWebhookEvent,
} from "../../interfaces/payment-gateway.interface.js";
import { AppError } from "../../errors/app-error.js";
import { ErrorCode } from "@loompilot/shared";
import { logger } from "../../utils/logger.js";

export class RazorpayGateway implements IPaymentGateway {
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;

  constructor(options: { keyId: string; keySecret: string; webhookSecret: string }) {
    this.keyId = options.keyId;
    this.keySecret = options.keySecret;
    this.webhookSecret = options.webhookSecret;
  }

  async createOrder(params: CreatePaymentOrderParams): Promise<PaymentOrderResult> {
    if (!this.keyId || !this.keySecret) {
      throw new AppError(ErrorCode.SERVICE_UNAVAILABLE, "Razorpay API credentials not configured", 500);
    }

    const authHeader = `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64")}`;
    const url = "https://api.razorpay.com/v1/orders";

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({
          amount: params.amountPaise,
          currency: params.currency || "INR",
          receipt: params.receipt,
          notes: params.notes,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const errText = await response.text();
        logger.error({ status: response.status, errText }, "Razorpay order creation failed");
        throw new AppError(ErrorCode.SERVICE_UNAVAILABLE, `Razorpay error: ${errText}`, 502);
      }

      const data = (await response.json()) as any;
      return {
        gatewayOrderId: data.id,
        amountPaise: data.amount,
        currency: data.currency,
        status: data.status,
      };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      logger.error({ err: err.message }, "Razorpay network error");
      throw new AppError(ErrorCode.SERVICE_UNAVAILABLE, "Failed to connect to payment gateway", 502);
    }
  }

  verifySignature(params: VerifyPaymentSignatureParams): boolean {
    if (!params.signature || !this.keySecret) return false;
    try {
      const payload = `${params.gatewayOrderId}|${params.paymentId}`;
      const expected = crypto.createHmac("sha256", this.keySecret).update(payload).digest("hex");

      const expectedBuf = Buffer.from(expected);
      const signatureBuf = Buffer.from(params.signature);

      if (expectedBuf.length !== signatureBuf.length) {
        return false;
      }
      return crypto.timingSafeEqual(expectedBuf, signatureBuf);
    } catch {
      return false;
    }
  }

  parseWebhook(payload: any, signatureHeader?: string): PaymentWebhookEvent {
    if (!signatureHeader || !this.webhookSecret) {
      throw new AppError(ErrorCode.PAYMENT_SIGNATURE_INVALID, "Missing webhook signature or secret", 400);
    }

    const bodyString = typeof payload === "string" ? payload : JSON.stringify(payload);
    const expectedSignature = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(bodyString)
      .digest("hex");

    const expectedBuf = Buffer.from(expectedSignature);
    const signatureBuf = Buffer.from(signatureHeader);

    if (expectedBuf.length !== signatureBuf.length || !crypto.timingSafeEqual(expectedBuf, signatureBuf)) {
      throw new AppError(ErrorCode.PAYMENT_SIGNATURE_INVALID, "Invalid Razorpay webhook signature", 400);
    }

    const event = typeof payload === "string" ? JSON.parse(payload) : payload;
    const paymentEntity = event?.payload?.payment?.entity;

    return {
      eventType: event?.event || "unknown",
      gatewayOrderId: paymentEntity?.order_id || "",
      paymentId: paymentEntity?.id || "",
      amountPaise: paymentEntity?.amount || 0,
      currency: paymentEntity?.currency || "INR",
      notes: paymentEntity?.notes || {},
      rawEvent: event,
    };
  }
}

