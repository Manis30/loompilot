import { Request, Response, NextFunction } from "express";
import { logger } from "../config/logger.js";

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

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

  res.status(statusCode).json({
    error: err.name || "ServerError",
    message,
    requestId: req.requestId,
    ...(process.env.NODE_ENV !== "production" ? { stack: err.stack } : {}),
  });
}
