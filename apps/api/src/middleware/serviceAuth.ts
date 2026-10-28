import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { HEADERS } from "@loompilot/shared";
import { env } from "../config/env.js";

export function serviceAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers[HEADERS.SERVICE_TOKEN] as string | undefined;

  if (!token) {
    res.status(401).json({
      error: "Unauthorized",
      message: `Missing ${HEADERS.SERVICE_TOKEN} header`,
      requestId: req.requestId,
    });
    return;
  }

  // Use timingSafeEqual to avoid timing side-channel leaks
  const expectedBuffer = Buffer.from(env.INTERNAL_SERVICE_TOKEN);
  const actualBuffer = Buffer.from(token);

  if (
    expectedBuffer.length !== actualBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    res.status(403).json({
      error: "Forbidden",
      message: "Invalid internal service token",
      requestId: req.requestId,
    });
    return;
  }

  next();
}
