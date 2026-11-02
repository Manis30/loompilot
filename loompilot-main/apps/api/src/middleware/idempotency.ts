import { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { IdempotencyRepository } from "../repositories/idempotency.repository.js";
import { resolveRouteKey } from "./rbac.js";
import { IDEMPOTENT_FLAGGED_ROUTES } from "@loompilot/shared";
import { AppError } from "../errors/app-error.js";
import { ErrorCode } from "@loompilot/shared";
import { logger } from "../utils/logger.js";

const idempotencyRepo = new IdempotencyRepository();

/**
 * Computes a deterministic SHA-256 hash of the incoming request payload.
 */
function computeRequestHash(req: Request): string {
  const payload = JSON.stringify({
    method: req.method.toUpperCase(),
    path: req.originalUrl || req.url,
    body: req.body || {},
  });
  return crypto.createHash("sha256").update(payload).digest("hex");
}

/**
 * Idempotency Middleware:
 * Provides transparent, database-backed idempotent execution for non-safe HTTP routes.
 */
export async function idempotencyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const headerKey = req.headers["idempotency-key"];
  const routeKey = resolveRouteKey(req);
  const isFlagged = IDEMPOTENT_FLAGGED_ROUTES.has(routeKey);

  if (!headerKey) {
    if (isFlagged && req.method !== "GET" && req.method !== "HEAD") {
      return next(
        new AppError(
          ErrorCode.VALIDATION_FAILED,
          `Idempotency-Key header is mandatory for route '${routeKey}'`,
          400
        )
      );
    }
    return next();
  }

  const key = String(headerKey).trim();
  if (key.length === 0 || key.length > 256) {
    return next(
      new AppError(
        ErrorCode.VALIDATION_FAILED,
        "Idempotency-Key must be a non-empty string of at most 256 characters",
        400
      )
    );
  }

  const tenantId =
    (req.headers["x-tenant-id"] as string) ||
    req.tenantId ||
    req.actor?.tenantId ||
    (req.body && req.body.tenantId) ||
    "default";
  const route = `${req.method.toUpperCase()} ${req.baseUrl || ""}${req.path}`;
  const requestHash = computeRequestHash(req);

  try {
    const claim = await idempotencyRepo.claimKey({
      tenantId,
      key,
      route,
      requestHash,
      ttlSeconds: 86400, // 24 hours
    });

    if (!claim.claimed && claim.existingRecord) {
      const existing = claim.existingRecord;

      if (existing.state === "in_progress") {
        return next(
          new AppError(
            ErrorCode.IDEMPOTENCY_IN_PROGRESS,
            "An identical request is currently being processed with this Idempotency-Key",
            409
          )
        );
      }

      if (existing.state === "completed") {
        if (existing.requestHash !== requestHash) {
          return next(
            new AppError(
              ErrorCode.IDEMPOTENCY_KEY_REUSED,
              "This Idempotency-Key was already used with a different request payload",
              422
            )
          );
        }

        // Replay stored response
        res.setHeader("Idempotent-Replay", "true");
        const status = existing.responseStatus || 200;
        res.status(status).json(existing.responseBody);
        return;
      }
    }

    // Intercept response to record completion or release key on 5xx
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    let capturedBody: any = null;

    res.json = (body: any): Response => {
      capturedBody = body;
      return originalJson(body);
    };

    res.send = (body: any): Response => {
      if (!capturedBody) {
        try {
          capturedBody = JSON.parse(body);
        } catch {
          capturedBody = body;
        }
      }
      return originalSend(body);
    };

    res.on("finish", async () => {
      const statusCode = res.statusCode;

      if (statusCode >= 400) {
        // Release key on error (both 4xx client errors and 5xx server faults)
        // so a failed transaction never leaves a cached record that blocks legitimate retries
        try {
          await idempotencyRepo.releaseKey({ tenantId, key, route });
          logger.warn({ key, route, statusCode }, "Released idempotency key due to error status");
        } catch (releaseErr: any) {
          logger.error({ err: releaseErr.message, key }, "Failed to release idempotency key on error");
        }
      } else {
        // Store completed response
        try {
          await idempotencyRepo.completeKey({
            tenantId,
            key,
            route,
            responseStatus: statusCode,
            responseBody: capturedBody,
          });
        } catch (completeErr: any) {
          logger.error({ err: completeErr.message, key }, "Failed to persist completed idempotency response");
        }
      }
    });

    next();
  } catch (err) {
    next(err);
  }
}
