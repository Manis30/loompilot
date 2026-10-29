import { Request, Response, NextFunction } from "express";
import { logger } from "../config/logger.js";
import { AppError } from "../errors/index.js";

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err instanceof AppError ? err.statusCode : err.status || err.statusCode || 500;
  const errorCode = err instanceof AppError ? err.code : err.name || "ServerError";
  const message = err.message || "Internal Server Error";

  if (statusCode >= 500) {
    logger.error(
      {
        err,
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        tenantId: req.user?.tenantId,
      },
      `Unhandled error: ${message}`
    );
  } else {
    logger.warn(
      {
        statusCode,
        errorCode,
        message,
        requestId: req.requestId,
        path: req.originalUrl,
      },
      `Client error: ${message}`
    );
  }

  res.status(statusCode).json({
    error: {
      code: errorCode,
      message,
      ...(err.details ? { details: err.details } : {}),
      requestId: req.requestId,
    },
    ...(process.env.NODE_ENV === "development" ? { stack: err.stack } : {}),
  });
}
