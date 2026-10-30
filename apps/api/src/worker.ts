import { getEnv } from "./config/env.js";
import { connectMongo, disconnectMongo } from "./config/database.js";
import { connectRedis, disconnectRedis } from "./config/redis.js";
import { logger } from "./utils/logger.js";

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

  // Graceful shutdown
  let isShuttingDown = false;

  async function shutdown(signal: string) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info({ signal }, "Worker shutting down...");

    try {
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

