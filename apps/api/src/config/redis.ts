import { Redis } from "ioredis";
import { env } from "./env.js";
import { logger } from "./logger.js";

export let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
      lazyConnect: true,
      maxRetriesPerRequest: null,
      retryStrategy(times) {
        if (env.NODE_ENV === "test") return null;
        return Math.min(times * 50, 2000);
      },
    });

    redisClient.on("connect", () => {
      logger.info("Redis connected successfully");
    });

    redisClient.on("error", (err) => {
      if (env.NODE_ENV !== "test") {
        logger.error({ err }, "Redis connection error");
      }
    });
  }

  return redisClient;
}
