import { Queue, JobsOptions as BullJobsOptions } from "bullmq";
import { Redis } from "ioredis";
import { IJobQueue, JobOptions } from "../interfaces/job-queue.interface.js";
import { logger } from "../utils/logger.js";

export class BullMqJobQueue implements IJobQueue {
  private readonly queues = new Map<string, Queue>();
  private readonly redisClient: Redis;

  constructor(redisClient: Redis) {
    this.redisClient = redisClient;
  }

  private getQueue(name: string): Queue {
    let queue = this.queues.get(name);
    if (!queue) {
      queue = new Queue(name, {
        connection: this.redisClient,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2000,
          },
          removeOnComplete: 100,
          removeOnFail: 500, // Dead letter retention
        },
      });
      this.queues.set(name, queue);
    }
    return queue;
  }

  async addJob<T = any>(
    queueName: string,
    jobName: string,
    data: T,
    options?: JobOptions
  ): Promise<string> {
    const queue = this.getQueue(queueName);
    const opts: BullJobsOptions = {
      attempts: options?.attempts,
      backoff: options?.backoff,
      delay: options?.delay,
      removeOnComplete: options?.removeOnComplete,
      removeOnFail: options?.removeOnFail,
      jobId: options?.jobId,
    };

    const job = await queue.add(jobName, data, opts);
    return String(job.id);
  }

  async addDelayedJob<T = any>(
    queueName: string,
    jobName: string,
    data: T,
    delayMs: number,
    options?: Omit<JobOptions, "delay">
  ): Promise<string> {
    return this.addJob<T>(queueName, jobName, data, {
      ...options,
      delay: delayMs,
    });
  }

  async addRepeatableJob<T = any>(
    queueName: string,
    jobName: string,
    data: T,
    cron: string,
    jobKey?: string
  ): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.add(jobName, data, {
      repeat: {
        pattern: cron,
        jobId: jobKey,
      },
      removeOnComplete: 50,
      removeOnFail: 200,
    });
    logger.info({ queueName, jobName, cron }, "Registered repeatable job");
  }

  async close(): Promise<void> {
    for (const [name, queue] of this.queues.entries()) {
      try {
        await queue.close();
      } catch (err) {
        logger.warn({ queue: name, err }, "Error closing queue");
      }
    }
    this.queues.clear();
  }
}

