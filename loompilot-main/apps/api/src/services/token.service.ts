import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { getEnv } from "../config/env.js";
import { AppError } from "../errors/app-error.js";
import { ErrorCode } from "@loompilot/shared";

export interface AccessTokenClaims {
  sub: string; // subjectId
  realm: "user" | "client";
  tenantId: string;
  role?: "admin" | "supervisor";
  clientId?: string;
  processAreas?: string[];
  jti: string;
  aud: "loompilot-user" | "loompilot-client";
  iss: string;
}

export interface InviteTokenClaims {
  sub: string; // clientId
  purpose: "invite";
  tenantId: string;
  email?: string;
  invitedAtMs: number;
  jti: string;
  iss: string;
}

export class TokenService {
  private static readonly ISSUER = "loompilot-api";

  /**
   * Generates a signed HS256 access token with standard LoomPilot claims.
   */
  static generateAccessToken(params: {
    subjectId: string;
    realm: "user" | "client";
    tenantId: string;
    role?: "admin" | "supervisor";
    clientId?: string;
    processAreas?: string[];
  }): { token: string; jti: string; expiresIn: string } {
    const env = getEnv();
    const jti = crypto.randomUUID();
    const audience = params.realm === "user" ? "loompilot-user" : "loompilot-client";

    const payload: Omit<AccessTokenClaims, "iss" | "aud"> = {
      sub: params.subjectId,
      realm: params.realm,
      tenantId: params.tenantId,
      jti,
      ...(params.role ? { role: params.role } : {}),
      ...(params.clientId ? { clientId: params.clientId } : {}),
      ...(params.processAreas ? { processAreas: params.processAreas } : {}),
    };

    const token = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      algorithm: "HS256",
      expiresIn: env.ACCESS_TOKEN_TTL as any,
      audience,
      issuer: this.ISSUER,
    });

    return { token, jti, expiresIn: env.ACCESS_TOKEN_TTL };
  }

  /**
   * Verifies an access token and validates signature, expiration, issuer, and expected audience realm.
   */
  static verifyAccessToken(
    token: string,
    expectedAudience?: "loompilot-user" | "loompilot-client"
  ): AccessTokenClaims {
    const env = getEnv();

    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
        algorithms: ["HS256"],
        issuer: this.ISSUER,
        ...(expectedAudience ? { audience: expectedAudience } : {}),
      }) as AccessTokenClaims;

      // Additional realm vs audience sanity check
      if (expectedAudience && decoded.aud !== expectedAudience) {
        throw new AppError(
          ErrorCode.UNAUTHENTICATED,
          `Token audience '${decoded.aud}' is invalid for this endpoint (expected '${expectedAudience}')`,
          401
        );
      }

      return decoded;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      if (err.name === "TokenExpiredError") {
        throw new AppError(ErrorCode.TOKEN_EXPIRED, "Access token has expired", 401);
      }
      throw new AppError(ErrorCode.UNAUTHENTICATED, "Invalid access token", 401, {
        details: err.message,
      });
    }
  }

  /**
   * Generates a cryptographically secure 48-byte opaque base64url refresh token.
   */
  static generateRefreshToken(): string {
    return crypto.randomBytes(48).toString("base64url");
  }

  /**
   * Computes the SHA-256 hash of a raw refresh token for safe storage.
   */
  static hashRefreshToken(rawToken: string): string {
    return crypto.createHash("sha256").update(rawToken).digest("hex");
  }

  /**
   * Generates a signed one-time client invite token (7-day validity).
   * Binds the invite token cryptographically to portalAccess.invitedAt epoch ms.
   */
  static generateInviteToken(params: {
    clientId?: string;
    accountId?: string;
    tenantId: string;
    email?: string;
    invitedAtMs?: number;
    invitedAt?: Date;
  }): string {
    const clientId = params.clientId || params.accountId;
    if (!clientId) {
      throw new AppError(
        ErrorCode.VALIDATION_FAILED,
        "clientId is required for invite token",
        400
      );
    }
    const env = getEnv();
    const jti = crypto.randomUUID();
    const invitedAtMs =
      params.invitedAtMs ?? (params.invitedAt ? params.invitedAt.getTime() : Date.now());

    const payload: Omit<InviteTokenClaims, "iss"> = {
      sub: clientId,
      purpose: "invite",
      tenantId: params.tenantId,
      invitedAtMs,
      ...(params.email ? { email: params.email } : {}),
      jti,
    };

    return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      algorithm: "HS256",
      expiresIn: env.INVITE_TOKEN_TTL as any,
      issuer: this.ISSUER,
    });
  }

  /**
   * Verifies and decodes a client invite token.
   */
  static verifyInviteToken(token: string): InviteTokenClaims {
    const env = getEnv();

    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
        algorithms: ["HS256"],
        issuer: this.ISSUER,
      }) as any;

      if (decoded.purpose !== "invite") {
        throw new AppError(
          ErrorCode.VALIDATION_FAILED,
          "Invalid token purpose; expected invite token",
          400
        );
      }

      if (typeof decoded.invitedAtMs !== "number") {
        throw new AppError(
          ErrorCode.VALIDATION_FAILED,
          "Invalid invitation token: missing invitedAt binding",
          400
        );
      }

      return decoded as InviteTokenClaims;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      if (err.name === "TokenExpiredError") {
        throw new AppError(
          ErrorCode.INVITE_EXPIRED,
          "Invitation link has expired",
          400
        );
      }
      throw new AppError(
        ErrorCode.VALIDATION_FAILED,
        "Invalid invitation token",
        400,
        { details: err.message }
      );
    }
  }
}
