import { logger } from "../config/logger.js";

export type JobHandler<T> = (data: T) => Promise<void>;

export class InMemoryQueue<T> {
  private handlers: Array<JobHandler<T>> = [];

  constructor(public readonly name: string) {}

  subscribe(handler: JobHandler<T>): void {
    this.handlers.push(handler);
  }

  async enqueue(data: T): Promise<void> {
    logger.debug({ queue: this.name }, "Job enqueued");
    // Fire asynchronously to avoid blocking the caller
    setImmediate(async () => {
      for (const handler of this.handlers) {
        try {
          await handler(data);
        } catch (err: any) {
          logger.error({ queue: this.name, error: err.message }, "Job processing error");
        }
      }
    });
  }
}

export interface MonitoringJobPayload {
  tenantId: string;
  orderId: string;
}

export interface PaymentFollowupPayload {
  tenantId: string;
  deliveryId: string;
}

export const monitoringQueue = new InMemoryQueue<MonitoringJobPayload>("monitoring-queue");
export const paymentFollowupQueue = new InMemoryQueue<PaymentFollowupPayload>("payment-followup-queue");

