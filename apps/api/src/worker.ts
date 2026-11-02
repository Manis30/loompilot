import { getEnv } from "./config/env.js";
import { connectMongo, disconnectMongo } from "./config/database.js";
import { connectRedis, disconnectRedis, getRedisClient } from "./config/redis.js";
import { logger } from "./utils/logger.js";
import { createContainer } from "./container.js";
import { OrderService } from "./services/order.service.js";
import { Worker } from "bullmq";

async function startWorker() {
  const env = getEnv();
  logger.info({ nodeEnv: env.NODE_ENV }, "Starting LoomPilot background worker process...");

  try {
    await connectMongo();
    await connectRedis();
    logger.info("Worker connected to MongoDB and Redis successfully");
  } catch (err) {
    logger.fatal({ err }, "Failed to initialize worker backing services");
    process.exit(1);
  }

  const container = createContainer();
  const orderService = new OrderService();
  logger.info("Worker container initialized with job queues and adapters");

  const defaultTenantId = "tenant_loompilot_tn_01";

  // Register BullMQ repeatable recurring jobs
  try {
    const queue = container.jobQueue;

    // 1. Quotation Expiration Reminders (Sent 1 day prior) - Doc §12, §15
    await queue.addRepeatableJob(
      "order-reminders",
      "quotation-expiration-reminders",
      { tenantId: defaultTenantId },
      "0 8 * * *",
      "quotation-expiration-reminders"
    );

    // 2. Payment Due Reminders (Upcoming & Overdue Milestones) - Doc §3.7, §11
    await queue.addRepeatableJob(
      "order-reminders",
      "payment-due-reminders",
      { tenantId: defaultTenantId },
      "0 9 * * *",
      "payment-due-reminders"
    );

    // 3. Quotation Expiry Status Transition Checker
    await queue.addRepeatableJob(
      "order-reminders",
      "quotation-expiry-checker",
      { tenantId: defaultTenantId },
      "0 0 * * *",
      "quotation-expiry-checker"
    );

    logger.info("BullMQ recurring reminder jobs successfully scheduled");
  } catch (err) {
    logger.warn({ err }, "Could not register repeatable jobs to Redis queue");
  }

  // BullMQ Worker to process scheduled reminder jobs
  let bullWorker: Worker | null = null;
  const isMock = process.env.USE_REDIS_MOCK === "true";

  if (!isMock) {
    try {
      bullWorker = new Worker(
        "order-reminders",
        async (job) => {
          logger.info({ jobName: job.name, jobId: job.id }, "Processing BullMQ reminder job");
          const tenantId = job.data?.tenantId || defaultTenantId;

          if (job.name === "quotation-expiration-reminders") {
            const count = await orderService.runQuoteReminders(tenantId);
            logger.info({ tenantId, count }, "Dispatched quotation expiration reminders");
          } else if (job.name === "payment-due-reminders") {
            const count = await orderService.checkOverduePayments(tenantId);
            logger.info({ tenantId, count }, "Dispatched payment due reminders");
          } else if (job.name === "quotation-expiry-checker") {
            const count = await orderService.checkAndExpireQuotations(tenantId);
            logger.info({ tenantId, count }, "Checked and expired quotations");
          }
        },
        { connection: getRedisClient() as any }
      );

      bullWorker.on("failed", (job, err) => {
        logger.error({ jobId: job?.id, jobName: job?.name, err }, "Worker job failed");
      });
    } catch (err) {
      logger.warn({ err }, "Could not start BullMQ Worker instance");
    }
  }

  // Fallback dev interval runner (ensures reminder checks execute reliably under mock Redis)
  let devInterval: NodeJS.Timeout | null = null;
  if (isMock || env.NODE_ENV === "development") {
    logger.info("Initializing fallback scheduler interval for development/mock mode");
    devInterval = setInterval(async () => {
      try {
        await orderService.runQuoteReminders(defaultTenantId);
        await orderService.checkOverduePayments(defaultTenantId);
        await orderService.checkAndExpireQuotations(defaultTenantId);
      } catch (err) {
        logger.warn({ err }, "Error in periodic dev reminder sweep");
      }
    }, 60000 * 30); // Run every 30 minutes in dev
  }

  // Graceful shutdown
  let isShuttingDown = false;

  async function shutdown(signal: string) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info({ signal }, "Worker shutting down...");

    if (devInterval) clearInterval(devInterval);
    if (bullWorker) {
      await bullWorker.close();
    }

    try {
      await container.jobQueue.close();
      await disconnectRedis();
      await disconnectMongo();
      logger.info("Worker shut down cleanly");
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "Error shutting down worker");
      process.exit(1);
    }
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

if (process.argv[1]?.endsWith("worker.ts") || process.argv[1]?.endsWith("worker.js")) {
  startWorker().catch((err) => {
    logger.fatal({ err }, "Worker startup failed");
    process.exit(1);
  });
}

export { startWorker };
