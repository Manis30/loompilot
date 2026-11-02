import http from "node:http";
import { getEnv } from "./config/env.js";
import { connectMongo, disconnectMongo } from "./config/database.js";
import { connectRedis, disconnectRedis } from "./config/redis.js";
import { logger } from "./utils/logger.js";
import { createApp } from "./app.js";
import { createContainer } from "./container.js";

async function bootstrap() {
  const env = getEnv();
  logger.info({ nodeEnv: env.NODE_ENV, port: env.PORT }, "Initializing LoomPilot API server...");

  // Initialize dependency container
  const container = createContainer();

  // Connect to persistent storage
  try {
    await connectMongo();
    await connectRedis();
  } catch (err) {
    logger.fatal({ err }, "Fatal: Failed to connect to backing services during startup");
    process.exit(1);
  }

  const app = createApp(container);
  const server = http.createServer(app);

  server.listen(env.PORT, () => {
    logger.info(
      {
        port: env.PORT,
        docs: `http://localhost:${env.PORT}/docs`,
        health: `http://localhost:${env.PORT}/health`,
        ready: `http://localhost:${env.PORT}/ready`,
      },
      "LoomPilot API Server listening"
    );
  });

  // Graceful shutdown handling
  let isShuttingDown = false;

  async function gracefulShutdown(signal: string) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info({ signal }, "Received shutdown signal. Commencing graceful shutdown...");

    // Force exit timeout after 10 seconds
    const forceExitTimer = setTimeout(() => {
      logger.error("Graceful shutdown timed out. Forcing process exit.");
      process.exit(1);
    }, 10000);
    forceExitTimer.unref();

    server.close(async (err) => {
      if (err) {
        logger.error({ err }, "Error while closing HTTP server");
      } else {
        logger.info("HTTP server closed");
      }

      try {
        await disconnectRedis();
        await disconnectMongo();
        logger.info("Backing service connections closed gracefully");
        process.exit(0);
      } catch (shutdownError) {
        logger.error({ err: shutdownError }, "Error during database/redis shutdown");
        process.exit(1);
      }
    });
  }

  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("unhandledRejection", (reason) => {
    logger.error(
      { err: reason instanceof Error ? reason : new Error(String(reason)) },
      "Unhandled promise rejection"
    );
  });
  process.on("uncaughtException", (error) => {
    logger.fatal({ err: error }, "Uncaught exception. Shutting down.");
    process.exit(1);
  });
}

// Start server if this is the entry point
if (process.argv[1]?.endsWith("server.ts") || process.argv[1]?.endsWith("server.js")) {
  bootstrap().catch((err) => {
    logger.fatal({ err }, "Bootstrap error");
    process.exit(1);
  });
}

export { bootstrap };

