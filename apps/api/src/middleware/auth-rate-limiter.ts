import { Request, Response, NextFunction } from "express";
import { getRedisClient } from "../config/redis.js";
import { getEnv } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { AppError } from "../errors/app-error.js";
import { ErrorCode } from "@loompilot/shared";

const LUA_INCR_EXPIRE = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return current
`;

/**
 * Strict Auth Rate Limiter Middleware
 *
 * Enforces strict attempt thresholds on /auth/login, /auth/refresh, and /client/auth/accept-invite.
 * CRITICAL BEHAVIOUR: FAILS CLOSED (503 Service Unavailable) if Redis is down,
 * preventing credential stuffing / brute force during infrastructure failures.
 */
export async function authRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const env = getEnv();
  const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
  const key = `rl:auth:${ip}`;
  const windowSeconds = Math.ceil(env.AUTH_RATE_LIMIT_WINDOW_MS / 1000);
  const maxAttempts = env.AUTH_RATE_LIMIT_MAX;

  try {
    const redis = getRedisClient();
    const current = (await redis.eval(
      LUA_INCR_EXPIRE,
      1,
      key,
      windowSeconds
    )) as number;

    res.setHeader("X-RateLimit-Limit", maxAttempts);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, maxAttempts - current));

    if (current > maxAttempts) {
      logger.warn({ ip, current, maxAttempts }, "Auth rate limit exceeded");
      return next(
        new AppError(
          ErrorCode.RATE_LIMITED,
          "Too many authentication attempts. Please wait before retrying.",
          429
        )
      );
    }

    next();
  } catch (err: any) {
    // FAIL CLOSED: If Redis is down, refuse auth traffic to prevent brute force abuse
    logger.error(
      { err: err.message, ip },
      "Auth rate limiter failed to contact Redis; FAILING CLOSED to protect credentials"
    );

    return next(
      new AppError(
        ErrorCode.SERVICE_UNAVAILABLE,
        "Authentication service is temporarily unavailable. Please try again shortly.",
        503
      )
    );
  }
}
