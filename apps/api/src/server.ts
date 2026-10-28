import http from "http";
import mongoose from "mongoose";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { connectDB } from "./config/db.js";
import { getRedisClient } from "./config/redis.js";
import { initSocketServer } from "./realtime/socket.js";
import { jobScheduler } from "./jobs/scheduler.js";

async function bootstrap() {
  try {
    await connectDB();

    // Connect to Redis if configured
    if (env.REDIS_HOST) {
      try {
        const redis = getRedisClient();
        await redis.connect();
      } catch (redisErr) {
        logger.warn({ redisErr }, "Redis not available, operating in standalone memory mode");
      }
    }

    const server = http.createServer(app);
    initSocketServer(server);

    server.listen(env.API_PORT, env.API_HOST, () => {
      logger.info(
        { port: env.API_PORT, host: env.API_HOST, env: env.NODE_ENV },
        `${env.APP_NAME} API server running`
      );
    });

    // Graceful shutdown handling
    const shutdown = async (signal: string) => {
      logger.info({ signal }, "Initiating graceful shutdown...");
      jobScheduler.stop();

      server.close(async () => {
        logger.info("HTTP server closed");
        try {
          await mongoose.disconnect();
          logger.info("MongoDB disconnected");
          const redis = getRedisClient();
          if (redis.status === "ready") {
            await redis.quit();
            logger.info("Redis connection closed");
          }
        } catch (cleanupErr) {
          logger.error({ cleanupErr }, "Error during cleanup");
        } finally {
          process.exit(0);
        }
      });
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (err) {
    logger.fatal({ err }, "Failed to bootstrap server");
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== "test") {
  bootstrap();
}
