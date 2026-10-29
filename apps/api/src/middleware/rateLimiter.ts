import { Request, Response, NextFunction } from "express";
import { rateLimit } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { getRedisClient } from "../config/redis.js";
import { env } from "../config/env.js";
import { ErrorCode } from "@loompilot/shared";

interface RateLimiterOptions {
  windowMs?: number;
  max: number;
  prefix?: string;
  message?: string;
}

export function createRateLimiter(options: RateLimiterOptions) {
  if (env.NODE_ENV === "test") {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }

  const windowMs = options.windowMs || 60 * 1000;
  let store: any = undefined;

  try {
    const redis = getRedisClient();
    store = new RedisStore({
      // @ts-ignore sendCommand compatibility with ioredis
      sendCommand: (...args: string[]) => redis.call(args[0], ...args.slice(1)),
      prefix: options.prefix || "rl:",
    });
  } catch {
    store = undefined; // fall back to in-memory store
  }

  return rateLimit({
    windowMs,
    limit: options.max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    store,
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        error: {
          code: ErrorCode.RATE_LIMITED,
          message: options.message || "Too many requests. Please try again later.",
          requestId: req.requestId,
        },
      });
    },
  });
}

export const generalApiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 100,
  prefix: "rl:api:",
  message: "Rate limit exceeded on API endpoints (100 req/min)",
});

export const authLoginLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 5,
  prefix: "rl:auth:login:",
  message: "Too many login attempts. Please try again after 1 minute.",
});

