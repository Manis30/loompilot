import { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { ErrorCode, ApiErrorEnvelope, TransitionError } from "@loompilot/shared";
import { AppError } from "../errors/app-error.js";
import { logger } from "../utils/logger.js";
import { getEnv } from "../config/env.js";

export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  const env = getEnv();
  const requestId = String(req.id ?? (req.headers["x-request-id"] as string) ?? "unknown");

  // 1. Operational AppError
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, requestId, path: req.path, method: req.method }, err.message);
    } else {
      logger.warn({ errCode: err.code, message: err.message, requestId, path: req.path }, "Handled operational error");
    }

    const payload: ApiErrorEnvelope = {
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        requestId,
      },
    };

    res.status(err.statusCode).json(payload);
    return;
  }

  // 1.5. State Transition Error
  if (err instanceof TransitionError) {
    logger.warn({ errCode: err.code, message: err.message, requestId, path: req.path }, "Handled transition error");
    const payload: ApiErrorEnvelope = {
      error: {
        code: err.code || ErrorCode.INVALID_TRANSITION,
        message: err.message,
        requestId,
      },
    };
    res.status(err.statusCode || 400).json(payload);
    return;
  }

  // 2. Zod validation error
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
      code: issue.code,
    }));

    logger.warn({ details, requestId, path: req.path }, "Validation failed");

    const payload: ApiErrorEnvelope = {
      error: {
        code: ErrorCode.VALIDATION_FAILED,
        message: "Validation failed",
        details,
        requestId,
      },
    };

    res.status(400).json(payload);
    return;
  }

  // 3. JSON body parsing syntax error
  if (err instanceof SyntaxError && "body" in err) {
    const payload: ApiErrorEnvelope = {
      error: {
        code: ErrorCode.VALIDATION_FAILED,
        message: "Invalid JSON in request payload",
        requestId,
      },
    };

    res.status(400).json(payload);
    return;
  }

  // 4. Request payload too large error (Express body limit)
  const httpError = err as { status?: number; statusCode?: number; type?: string };
  if (httpError?.status === 413 || httpError?.statusCode === 413 || httpError?.type === "entity.too.large") {
    const payload: ApiErrorEnvelope = {
      error: {
        code: ErrorCode.VALIDATION_FAILED,
        message: "Request payload exceeds maximum allowed size limit",
        requestId,
      },
    };

    res.status(413).json(payload);
    return;
  }

  // 5. Mongo duplicate key error
  const mongoError = err as { code?: number; keyPattern?: Record<string, unknown> };
  if (mongoError?.code === 11000) {
    const fields = Object.keys(mongoError.keyPattern ?? {}).join(", ");
    const payload: ApiErrorEnvelope = {
      error: {
        code: ErrorCode.DUPLICATE,
        message: `Duplicate resource conflict on fields: ${fields || "unique key"}`,
        details: mongoError.keyPattern,
        requestId,
      },
    };

    res.status(409).json(payload);
    return;
  }

  // 5. Unhandled internal error
  const standardError = err instanceof Error ? err : new Error(String(err));
  logger.error(
    {
      err: standardError,
      stack: standardError.stack,
      requestId,
      path: req.path,
      method: req.method,
    },
    "Unhandled internal server error"
  );

  const payload: ApiErrorEnvelope = {
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: env.NODE_ENV === "production" ? "Internal server error" : standardError.message,
      requestId,
    },
  };

  res.status(500).json(payload);
};
