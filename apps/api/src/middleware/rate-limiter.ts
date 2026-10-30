import rateLimit, { Store, Options, IncrementResponse } from "express-rate-limit";
import { Redis } from "ioredis";
import { RateLimitError } from "../errors/app-error.js";
import { Env } from "../config/env.js";
import { logger } from "../utils/logger.js";

/**
 * Lua script for atomic increment and expiry.
 *
 * Atomically increments the key and sets TTL (in milliseconds) if the key is newly created
 * or currently lacks an expiration. Returns a table containing:
 * - current: total hits in window
 * - ttl: remaining TTL in milliseconds
 */
const ATOMIC_INCR_LUA = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return { current, ttl }
`;

/**
 * Redis-backed rate limit store with atomic increment+expiry via Lua script.
 *
 * Operational Behavior:
 * - Atomic: INCR + PEXPIRE executed atomically within Redis.
 * - Fail-open: If Redis is down, unreachable, or returns an error, the store catches the error,
 *   logs a structured warning/error, and allows the request through with a default count (1),
 *   guaranteeing that Redis outages do not cause 500s or outage across the public API.
 * - Keying & Trust Proxy: By default, express-rate-limit uses `req.ip`. In production environments
 *   behind reverse proxies (Nginx, AWS ALB, Cloudflare), Express MUST have `app.set("trust proxy", 1)`
 *   configured so that `req.ip` resolves to the genuine client IP from `X-Forwarded-For`.
 */
export class RedisRateLimitStore implements Store {
  private readonly redis: Redis;
  public prefix: string;
  private windowMs = 900000;

  constructor(redis: Redis, prefix = "rl:") {
    this.redis = redis;
    this.prefix = prefix;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  async increment(key: string): Promise<IncrementResponse> {
    const fullKey = `${this.prefix}${key}`;
    try {
      // Execute atomic Lua script
      const rawResult = (await (this.redis as unknown as {
        eval: (script: string, numKeys: number, key: string, arg: number) => Promise<[number, number]>;
      }).eval(ATOMIC_INCR_LUA, 1, fullKey, this.windowMs)) as [number, number];

      const totalHits = Number(rawResult[0]);
      const pttl = Number(rawResult[1]);
      const resetTime = new Date(Date.now() + Math.max(0, pttl));

      return { totalHits, resetTime };
    } catch (err) {
      // Fail-open: Log failure and allow request to proceed without crashing or returning 500
      logger.error(
        { err, key: fullKey },
        "Redis rate-limiter store failure; failing open to preserve service availability"
      );
      return { totalHits: 1, resetTime: new Date(Date.now() + this.windowMs) };
    }
  }

  async decrement(key: string): Promise<void> {
    const fullKey = `${this.prefix}${key}`;
    try {
      await this.redis.decr(fullKey);
    } catch (err) {
      logger.warn({ err, key: fullKey }, "Failed to decrement rate limiter key");
    }
  }

  async resetKey(key: string): Promise<void> {
    const fullKey = `${this.prefix}${key}`;
    try {
      await this.redis.del(fullKey);
    } catch (err) {
      logger.warn({ err, key: fullKey }, "Failed to reset rate limiter key");
    }
  }
}

export function createRateLimiter(redis: Redis, env: Env) {
  const isTest = env.NODE_ENV === "test";

  return rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: isTest ? 10000 : env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisRateLimitStore(redis),
    handler: (_req, _res, next) => {
      next(new RateLimitError());
    },
  });
}
