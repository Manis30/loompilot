import { logger } from "../config/logger.js";
import { IJobQueue, JobHandler } from "../interfaces/job-queue.js";

export class InMemoryJobQueue<T> implements IJobQueue<T> {
  private handlers: Array<JobHandler<T>> = [];

  constructor(public readonly name: string) {}

  subscribe(handler: JobHandler<T>): void {
    this.handlers.push(handler);
  }

  async enqueue(data: T): Promise<void> {
    logger.debug({ queue: this.name }, "Job enqueued in memory queue");
    // Asynchronous dispatch
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

export const monitoringQueue: IJobQueue<MonitoringJobPayload> =
  new InMemoryJobQueue<MonitoringJobPayload>("monitoring-queue");

export const paymentFollowupQueue: IJobQueue<PaymentFollowupPayload> =
  new InMemoryJobQueue<PaymentFollowupPayload>("payment-followup-queue");
