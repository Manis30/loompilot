import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { UserRole, ErrorCode } from "@loompilot/shared";
import { env } from "../config/env.js";

export interface AuthUser {
  userId: string;
  email: string;
  role: UserRole;
  tenantId: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      error: {
        code: ErrorCode.UNAUTHENTICATED,
        message: "Authorization token required",
        requestId: req.requestId,
      },
    });
    return;
  }

  const token = authHeader.substring(7);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthUser;
    req.user = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      tenantId: payload.tenantId,
    };
    next();
  } catch (_err) {
    res.status(401).json({
      error: {
        code: ErrorCode.UNAUTHENTICATED,
        message: "Invalid or expired authorization token",
        requestId: req.requestId,
      },
    });
  }
}
