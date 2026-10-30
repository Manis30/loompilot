import { Redis } from "ioredis";
import { getEnv } from "./env.js";
import { logger } from "../utils/logger.js";

let redisClient: Redis | null = null;

/**
 * Extracts host and port from a Redis URL while guaranteeing any credentials/passwords are redacted.
 */
export function getRedactedRedisTarget(redisUrl: string): { host: string; port: string; hostPort: string } {
  try {
    const parsed = new URL(redisUrl);
    const host = parsed.hostname || "localhost";
    const port = parsed.port || "6379";
    return {
      host,
      port,
      hostPort: `${host}:${port}`,
    };
  } catch {
    const match = /@?([^:/@]+)(?::(\d+))?/.exec(redisUrl);
    const host = match?.[1] || "localhost";
    const port = match?.[2] || "6379";
    return {
      host,
      port,
      hostPort: `${host}:${port}`,
    };
  }
}

/**
 * Extracts the primary error code (e.g., ECONNREFUSED) from an error or AggregateError.
 */
export function extractErrorCode(err: unknown): string {
  if (!err || typeof err !== "object") return "UNKNOWN";
  const errorObj = err as { code?: string; errors?: Array<{ code?: string }> };
  if (errorObj.code) return errorObj.code;
  if (Array.isArray(errorObj.errors)) {
    for (const subErr of errorObj.errors) {
      if (subErr && typeof subErr === "object" && "code" in subErr && typeof subErr.code === "string") {
        return subErr.code;
      }
    }
  }
  return "UNKNOWN";
}

export function getRedisClient(): Redis {
  if (!redisClient) {
    const env = getEnv();
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: true,
      retryStrategy(times) {
        if (env.NODE_ENV === "test") return null; // Don't retry indefinitely in tests
        const delay = Math.min(times * 200, 3000);
        return delay;
      },
      lazyConnect: true,
    });

    redisClient.on("connect", () => {
      logger.info("Redis connecting...");
    });

    redisClient.on("ready", () => {
      logger.info("Redis connected and ready");
    });

    // Always log error object under the 'err' key (std serializer)
    redisClient.on("error", (err) => {
      logger.error({ err }, "Redis connection error");
    });

    redisClient.on("close", () => {
      logger.warn("Redis connection closed");
    });
  }

  return redisClient;
}

export function setRedisClient(client: Redis | null): void {
  redisClient = client;
}

export async function connectRedis(): Promise<Redis> {
  const env = getEnv();
  const client = getRedisClient();
  if (client.status === "wait" || client.status === "close") {
    try {
      await client.connect();
    } catch (err) {
      const { hostPort } = getRedactedRedisTarget(env.REDIS_URL);
      const errorCode = extractErrorCode(err);
      logger.error(
        { err },
        `Failed to connect to Redis at ${hostPort} (${errorCode})`
      );
      throw err;
    }
  }
  return client;
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    logger.info("Closing Redis connection...");
    try {
      if (redisClient.status !== "end" && typeof redisClient.quit === "function") {
        await redisClient.quit();
      }
    } catch {
      if (typeof redisClient.disconnect === "function") {
        redisClient.disconnect();
      }
    }
    redisClient = null;
    logger.info("Redis connection closed");
  }
}

export function isRedisReady(): boolean {
  if (!redisClient) return false;
  return redisClient.status === "ready" || redisClient.status === "connect";
}
