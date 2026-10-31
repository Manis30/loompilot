export interface CreatePaymentOrderParams {
  amountPaise: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface PaymentOrderResult {
  gatewayOrderId: string;
  amountPaise: number;
  currency: string;
  status: string;
}

export interface VerifyPaymentSignatureParams {
  gatewayOrderId: string;
  paymentId: string;
  signature: string;
}

export interface PaymentWebhookEvent {
  eventType: "payment.captured" | "payment.failed" | string;
  gatewayOrderId: string;
  paymentId: string;
  amountPaise: number;
  currency: string;
  notes?: Record<string, string>;
  rawEvent?: any;
}

export interface IPaymentGateway {
  createOrder(params: CreatePaymentOrderParams): Promise<PaymentOrderResult>;
  verifySignature(params: VerifyPaymentSignatureParams): boolean;
  parseWebhook(payload: any, signatureHeader?: string): PaymentWebhookEvent;
}

