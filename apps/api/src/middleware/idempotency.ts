import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { IdempotencyKeyModel } from "../models/idempotency-key.model.js";
import { IdempotencyConflictError } from "../errors/index.js";
import { ErrorCode } from "@loompilot/shared";

export interface IdempotencyOptions {
  allowBodyAlias?: boolean;
}

export function idempotencyMiddleware(options: IdempotencyOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    let key = (req.headers["idempotency-key"] as string | undefined)?.trim();

    if (!key && options.allowBodyAlias && req.body?.idempotencyKey) {
      key = String(req.body.idempotencyKey).trim();
    }

    if (key && options.allowBodyAlias && req.body && !req.body.idempotencyKey) {
      req.body.idempotencyKey = key;
    }

    if (!key) {
      res.status(400).json({
        error: {
          code: ErrorCode.VALIDATION_FAILED,
          message: "Idempotency-Key header is required for this operation",
          requestId: req.requestId,
        },
      });
      return;
    }

    const tenantId = req.user?.tenantId || (req.body?.tenantId as string) || "tenant_default";
    const requestHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(req.body || {}))
      .digest("hex");

    try {
      const existing = await IdempotencyKeyModel.findOne({ tenantId, key });

      if (existing) {
        if (existing.requestHash !== requestHash) {
          throw new IdempotencyConflictError();
        }

        // Return cached response
        res.setHeader("X-Idempotent-Replay", "true");
        res.status(existing.statusCode).json(existing.responseBody);
        return;
      }

      // Intercept response to store result
      const originalSend = res.send;
      let responseBodyCaptured: any;

      res.send = function (body?: any): Response {
        responseBodyCaptured = body;
        return originalSend.call(this, body);
      };

      res.on("finish", async () => {
        if (res.statusCode < 500 && responseBodyCaptured !== undefined) {
          try {
            let parsedBody = responseBodyCaptured;
            if (typeof responseBodyCaptured === "string") {
              try {
                parsedBody = JSON.parse(responseBodyCaptured);
              } catch {
                // Raw text or non-json
              }
            }

            await IdempotencyKeyModel.create({
              tenantId,
              key,
              endpoint: `${req.method} ${req.baseUrl}${req.path}`,
              requestHash,
              statusCode: res.statusCode,
              responseBody: parsedBody,
              expiresAt: new Date(Date.now() + 24 * 3600 * 1000), // 24-hour TTL
            });
          } catch (saveErr: any) {
            // If duplicate key was inserted concurrently
            if (saveErr?.code !== 11000) {
              // Log or ignore
            }
          }
        }
      });

      next();
    } catch (err) {
      next(err);
    }
  };
}
