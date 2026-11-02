import { Worker, Job } from "bullmq";
import { getEnv } from "./config/env.js";
import { connectMongo, disconnectMongo } from "./config/database.js";
import { connectRedis, disconnectRedis } from "./config/redis.js";
import { logger } from "./utils/logger.js";
import { createContainer } from "./container.js";
import { OrderService } from "./services/order.service.js";
import { SettingsModel } from "./models/identity/settings.model.js";
import { OutboxMessageModel } from "./models/platform/outbox-message.model.js";
import { ClientModel } from "./models/identity/client.model.js";
import { UserModel } from "./models/identity/user.model.js";

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

  // Helper to fetch all active tenant IDs
  async function getActiveTenantIds(): Promise<string[]> {
    try {
      const allSettings = await SettingsModel.find({}).lean();
      if (allSettings.length > 0) {
        return Array.from(new Set(allSettings.map((s) => s.tenantId)));
      }
    } catch (err) {
      logger.warn({ err }, "Could not fetch settings for tenants, falling back to default");
    }
    return [env.TENANT_DEFAULT_ID || "default"];
  }

  // 1. Process Outbox Pending Messages (Email notifications & dispatch)
  async function processOutboxMessages(): Promise<number> {
    let processed = 0;
    try {
      const pendingMessages = await OutboxMessageModel.find({
        status: "pending",
        nextAttemptAt: { $lte: new Date() },
      })
        .limit(50)
        .exec();

      for (const msg of pendingMessages) {
        msg.status = "processing";
        msg.attempts += 1;
        await msg.save();

        try {
          if (msg.channel === "email") {
            let targetEmail: string | undefined;

            if (msg.recipient.clientId) {
              const client = await ClientModel.findById(msg.recipient.clientId).lean();
              targetEmail = client?.email || client?.portalAccess?.email;
            } else if (msg.recipient.userId) {
              const user = await UserModel.findById(msg.recipient.userId).lean();
              targetEmail = user?.email;
            }

            if (targetEmail && container.notifier) {
              await container.notifier.sendEmail({
                to: targetEmail,
                subject: msg.payload?.subject || "LoomPilot Notification",
                html: `<p>${msg.payload?.subject || "LoomPilot Notification"}</p>`,
                text: typeof msg.payload === "string" ? msg.payload : JSON.stringify(msg.payload || {}),
              });
            }
          }

          msg.status = "sent";
          msg.error = undefined;
          await msg.save();
          processed++;
        } catch (dispatchErr: any) {
          logger.error({ err: dispatchErr, messageId: msg._id }, "Failed to dispatch outbox message");
          msg.error = dispatchErr?.message || String(dispatchErr);
          if (msg.attempts >= 3) {
            msg.status = "failed";
          } else {
            msg.status = "pending";
            msg.nextAttemptAt = new Date(Date.now() + 60000 * msg.attempts); // exponential backoff
          }
          await msg.save();
        }
      }
    } catch (err) {
      logger.error({ err }, "Error processing outbox messages");
    }
    return processed;
  }

  // 2. Execute scheduled reminder cycle for quotation & payment milestones
  async function executeReminderCycle(): Promise<void> {
    const tenantIds = await getActiveTenantIds();
    for (const tenantId of tenantIds) {
      try {
        const quotesSent = await orderService.runQuoteReminders(tenantId);
        const paymentsSent = await orderService.runPaymentReminders(tenantId);
        logger.info(
          { tenantId, quotesSent, paymentsSent },
          "Scheduled reminders sweep completed"
        );
      } catch (err) {
        logger.error({ err, tenantId }, "Error running reminder cycle for tenant");
      }
    }
    await processOutboxMessages();
  }

  // 3. Register BullMQ Repeatable Cron Jobs
  // Quotation reminders: daily at 9:00 AM (reminds clients on previous day per user answer)
  // Payment milestone reminders: daily at 10:00 AM (reminds clients on previous day)
  // Outbox worker: every 5 minutes
  try {
    await container.jobQueue.addRepeatableJob(
      "scheduled-tasks",
      "quotation-reminders",
      {},
      "0 9 * * *",
      "quote-reminders-daily-9am"
    );

    await container.jobQueue.addRepeatableJob(
      "scheduled-tasks",
      "payment-reminders",
      {},
      "0 10 * * *",
      "payment-reminders-daily-10am"
    );

    await container.jobQueue.addRepeatableJob(
      "scheduled-tasks",
      "outbox-dispatch",
      {},
      "*/5 * * * *",
      "outbox-dispatch-every-5m"
    );

    logger.info("BullMQ repeatable cron jobs successfully scheduled");
  } catch (queueErr) {
    logger.warn({ err: queueErr }, "Notice: could not register repeatable BullMQ jobs (Redis may be in stand-alone mode)");
  }

  // 4. BullMQ Worker to process scheduled tasks
  const bullmqWorker = new Worker(
    "scheduled-tasks",
    async (job: Job) => {
      logger.info({ jobName: job.name, jobId: job.id }, "BullMQ Worker executing scheduled job");
      if (job.name === "quotation-reminders") {
        const tenantIds = await getActiveTenantIds();
        for (const tId of tenantIds) {
          await orderService.runQuoteReminders(tId);
        }
      } else if (job.name === "payment-reminders") {
        const tenantIds = await getActiveTenantIds();
        for (const tId of tenantIds) {
          await orderService.runPaymentReminders(tId);
        }
      } else if (job.name === "outbox-dispatch") {
        await processOutboxMessages();
      }
    },
    {
      connection: container.redisClient,
      concurrency: 2,
    }
  );

  bullmqWorker.on("completed", (job) => {
    logger.info({ jobId: job.id, jobName: job.name }, "Scheduled task completed successfully");
  });

  bullmqWorker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, jobName: job?.name, err }, "Scheduled task failed");
  });

  // Run initial immediate sweep on worker launch so pending reminders and outbox messages process promptly
  executeReminderCycle().catch((err) => {
    logger.error({ err }, "Initial reminder sweep encountered an error");
  });

  // Graceful shutdown
  let isShuttingDown = false;

  async function shutdown(signal: string) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info({ signal }, "Worker shutting down...");

    try {
      await bullmqWorker.close();
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
