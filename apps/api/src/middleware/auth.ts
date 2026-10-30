import { Request, Response, NextFunction } from "express";
import { TokenService } from "../services/token.service.js";
import { StatusCacheService } from "../services/status-cache.service.js";
import { UserModel } from "../models/identity/user.model.js";
import { ClientAccountModel } from "../models/identity/client-account.model.js";
import { AppError } from "../errors/app-error.js";
import { ErrorCode } from "@loompilot/shared";

export interface Actor {
  realm: "user" | "client";
  subjectId: string;
  tenantId: string;
  role?: "admin" | "supervisor";
  clientId?: string;
  clientAccountId?: string;
  processAreas?: string[];
  requestId?: string;
}

declare global {
  namespace Express {
    interface Request {
      actor?: Actor;
      tenantId?: string;
    }
  }
}

/**
 * Authentication Middleware:
 * Validates JWT access token, enforces realm audience, re-checks account status
 * via Redis (60s TTL), and sets immutable req.actor & req.tenantId.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(
      new AppError(
        ErrorCode.UNAUTHENTICATED,
        "Missing or malformed Authorization header. Expected 'Bearer <token>'",
        401
      )
    );
  }

  const token = authHeader.slice(7).trim();

  try {
    const claims = TokenService.verifyAccessToken(token);

    // Fast status re-check via Redis cache (fallback to MongoDB if not cached)
    let status = await StatusCacheService.getStatus(
      claims.realm,
      claims.tenantId,
      claims.sub
    );

    let processAreas: string[] | undefined;

    if (!status) {
      if (claims.realm === "user") {
        const user = await UserModel.findOne({
          tenantId: claims.tenantId,
          _id: claims.sub,
        }).lean();

        if (!user) {
          throw new AppError(ErrorCode.UNAUTHENTICATED, "Authenticated user no longer exists", 401);
        }
        status = user.status;
        processAreas = user.processAreas;
      } else {
        const account = await ClientAccountModel.findOne({
          tenantId: claims.tenantId,
          _id: claims.sub,
        }).lean();

        if (!account) {
          throw new AppError(ErrorCode.UNAUTHENTICATED, "Authenticated client account no longer exists", 401);
        }
        status = account.status;
      }

      await StatusCacheService.setStatus(
        claims.realm,
        claims.tenantId,
        claims.sub,
        status,
        60
      );
    }

    if (status !== "active") {
      throw new AppError(
        ErrorCode.ACCOUNT_LOCKED,
        "Account is locked or inactive. Access revoked.",
        403
      );
    }

    // Build standard Actor
    req.actor = {
      realm: claims.realm,
      subjectId: claims.sub,
      tenantId: claims.tenantId,
      role: claims.role,
      clientId: claims.clientId,
      clientAccountId: claims.clientAccountId,
      processAreas,
      requestId: (req as any).id,
    };

    // STRICT MULTI-TENANCY RULE: tenantId comes ONLY from the verified token!
    // Ignore any tenantId in bodies, queries or headers.
    req.tenantId = claims.tenantId;

    next();
  } catch (err) {
    next(err);
  }
}
