import { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { HEADERS } from "@loompilot/shared";

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.headers[HEADERS.REQUEST_ID] ?? req.headers["x-request-id"];
  const requestId = (typeof incomingId === "string" && incomingId.trim().length > 0)
    ? incomingId.trim()
    : crypto.randomUUID();

  req.id = requestId;
  res.setHeader(HEADERS.REQUEST_ID, requestId);
  next();
}

