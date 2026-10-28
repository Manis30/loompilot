import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { HEADERS } from "@loompilot/shared";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.headers[HEADERS.REQUEST_ID] as string | undefined;
  const requestId = incomingId || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader(HEADERS.REQUEST_ID, requestId);
  next();
}

