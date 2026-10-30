import { getEnv } from "../config/env.js";
import { AppError } from "../errors/app-error.js";
import { ErrorCode } from "@loompilot/shared";
import { TokenService } from "./token.service.js";
import { UserRepository } from "../repositories/user.repository.js";
import { ClientRepository } from "../repositories/client.repository.js";
import { RefreshTokenRepository } from "../repositories/refresh-token.repository.js";
import { AuditService } from "./audit.service.js";
import { StatusCacheService } from "./status-cache.service.js";
import {
  comparePassword,
  hashPassword,
  runDummyHash,
  validatePasswordPolicy,
} from "../utils/password.js";

export class AuthService {
  constructor(
    private readonly userRepo = new UserRepository(),
    private readonly clientRepo = new ClientRepository(),
    private readonly refreshTokenRepo = new RefreshTokenRepository(),
    private readonly auditService = new AuditService()
  ) {}

  /**
   * Validates request Origin against configured CORS_ORIGINS to prevent CSRF on cookie routes.
   */
  validateOrigin(origin?: string): void {
    if (!origin) return; // Non-browser / same-origin calls
    const env = getEnv();
    const allowed = env.CORS_ORIGINS.split(",").map((s) => s.trim().toLowerCase());
    if (!allowed.includes(origin.toLowerCase())) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        `Cross-Origin request from origin '${origin}' is not allowed`,
        403
      );
    }
  }

  /**
   * User Realm Login (Staff: admin, supervisor)
   */
  async loginUser(params: {
    tenantId: string;
    email: string;
    password: string;
    ip?: string;
    requestId?: string;
  }) {
    const { tenantId, email, password, ip, requestId } = params;
    const user = await this.userRepo.findByEmail(tenantId, email);

    if (!user) {
      await runDummyHash(password);
      await this.auditService.log({
        tenantId,
        actor: { id: null, type: "system", email },
        action: "LOGIN_FAILED",
        entity: { collection: "users", id: "unknown" },
        ip,
        requestId,
      });
      throw new AppError(ErrorCode.INVALID_CREDENTIALS, "Invalid email or password", 401);
    }

    const userId = String(user._id);

    // Check account lockout status
    if (user.status === "locked") {
      const lockedUntil = user.lockout?.lockedUntil;
      if (!lockedUntil || lockedUntil > new Date()) {
        await this.auditService.log({
          tenantId,
          actor: { id: userId, type: "user", email },
          action: "LOGIN_LOCKED_ATTEMPT",
          entity: { collection: "users", id: userId },
          ip,
          requestId,
        });
        throw new AppError(
          ErrorCode.ACCOUNT_LOCKED,
          "Account is locked. Please try again later or contact your administrator.",
          403
        );
      }
      // Lockout expired, auto-unlock
      await this.userRepo.resetLockout(tenantId, userId);
    }

    const isMatch = await comparePassword(password, user.passwordHash);

    if (!isMatch) {
      const env = getEnv();
      const { lockedNow } = await this.userRepo.incrementFailedLogin(
        tenantId,
        userId,
        env.LOCKOUT_THRESHOLD,
        env.LOCKOUT_DURATION_MINUTES
      );

      if (lockedNow) {
        await StatusCacheService.invalidate("user", tenantId, userId);
        await this.refreshTokenRepo.revokeAllForSubject(
          tenantId,
          "user",
          userId
        );
        await this.auditService.log({
          tenantId,
          actor: { id: userId, type: "user", email },
          action: "ACCOUNT_LOCKED",
          entity: { collection: "users", id: userId },
          ip,
          requestId,
        });
      }

      await this.auditService.log({
        tenantId,
        actor: { id: userId, type: "user", email },
        action: "LOGIN_FAILED",
        entity: { collection: "users", id: userId },
        ip,
        requestId,
      });

      throw new AppError(ErrorCode.INVALID_CREDENTIALS, "Invalid email or password", 401);
    }

    // Reset failed login count on successful authentication
    await this.userRepo.resetLockout(tenantId, userId);

    // Issue tokens
    const { token: accessToken, expiresIn } = TokenService.generateAccessToken({
      subjectId: userId,
      realm: "user",
      tenantId,
      role: user.role,
    });

    const rawRefreshToken = TokenService.generateRefreshToken();
    const tokenHash = TokenService.hashRefreshToken(rawRefreshToken);
    const familyId = crypto.randomUUID();
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.refreshTokenRepo.createToken({
      tenantId,
      realm: "user",
      subjectId: userId,
      familyId,
      tokenHash,
      expiresAt: refreshExpiresAt,
    });

    // Cache active status
    await StatusCacheService.setStatus("user", tenantId, userId, "active", 60);

    await this.auditService.log({
      tenantId,
      actor: { id: userId, type: "user", email },
      action: "LOGIN_SUCCESS",
      entity: { collection: "users", id: userId },
      ip,
      requestId,
    });

    return {
      accessToken,
      expiresIn,
      rawRefreshToken,
      user: {
        id: String(user._id),
        email: user.email,
        name: user.name,
        role: user.role,
        processAreas: user.processAreas || [],
      },
    };
  }

  /**
   * Client Realm Login (client portal contacts)
   */
  async loginClient(params: {
    tenantId: string;
    email: string;
    password: string;
    ip?: string;
    requestId?: string;
  }) {
    const { tenantId, email, password, ip, requestId } = params;
    const client = await this.clientRepo.findByPortalEmail(tenantId, email, true);

    if (!client || !client.portalAccess?.email) {
      await runDummyHash(password);
      await this.auditService.log({
        tenantId,
        actor: { id: null, type: "system", email },
        action: "CLIENT_LOGIN_FAILED",
        entity: { collection: "clients", id: "unknown" },
        ip,
        requestId,
      });
      throw new AppError(ErrorCode.INVALID_CREDENTIALS, "Invalid email or password", 401);
    }

    if (client.portalAccess.status === "invited") {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        "Account invitation has not been accepted yet. Please use the invitation link sent to your email.",
        403
      );
    }

    const clientId = String(client._id);

    if (client.portalAccess.status === "locked") {
      const lockedUntil = client.portalAccess.lockout?.lockedUntil;
      if (!lockedUntil || lockedUntil > new Date()) {
        await this.auditService.log({
          tenantId,
          actor: { id: clientId, type: "client", email },
          action: "CLIENT_LOGIN_LOCKED_ATTEMPT",
          entity: { collection: "clients", id: clientId },
          ip,
          requestId,
        });
        throw new AppError(
          ErrorCode.ACCOUNT_LOCKED,
          "Account is locked. Please try again later or contact your account representative.",
          403
        );
      }
      // Lockout expired, auto-unlock
      await this.clientRepo.resetLockout(tenantId, clientId);
    }

    if (!client.portalAccess.passwordHash) {
      throw new AppError(ErrorCode.INVALID_CREDENTIALS, "Invalid email or password", 401);
    }

    const isMatch = await comparePassword(password, client.portalAccess.passwordHash);

    if (!isMatch) {
      const env = getEnv();
      const { lockedNow } = await this.clientRepo.incrementFailedLogin(
        tenantId,
        clientId,
        env.LOCKOUT_THRESHOLD,
        env.LOCKOUT_DURATION_MINUTES
      );

      if (lockedNow) {
        await StatusCacheService.invalidate("client", tenantId, clientId);
        await this.refreshTokenRepo.revokeAllForSubject(
          tenantId,
          "client",
          clientId
        );
        await this.auditService.log({
          tenantId,
          actor: { id: clientId, type: "client", email },
          action: "CLIENT_ACCOUNT_LOCKED",
          entity: { collection: "clients", id: clientId },
          ip,
          requestId,
        });
      }

      await this.auditService.log({
        tenantId,
        actor: { id: clientId, type: "client", email },
        action: "CLIENT_LOGIN_FAILED",
        entity: { collection: "clients", id: clientId },
        ip,
        requestId,
      });

      throw new AppError(ErrorCode.INVALID_CREDENTIALS, "Invalid email or password", 401);
    }

    // Reset failed login count
    await this.clientRepo.resetLockout(tenantId, clientId);

    const { token: accessToken, expiresIn } = TokenService.generateAccessToken({
      subjectId: clientId,
      realm: "client",
      tenantId,
      clientId,
      clientAccountId: clientId,
    });

    const rawRefreshToken = TokenService.generateRefreshToken();
    const tokenHash = TokenService.hashRefreshToken(rawRefreshToken);
    const familyId = crypto.randomUUID();
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.refreshTokenRepo.createToken({
      tenantId,
      realm: "client",
      subjectId: clientId,
      familyId,
      tokenHash,
      expiresAt: refreshExpiresAt,
    });

    await StatusCacheService.setStatus("client", tenantId, clientId, "active", 60);

    await this.auditService.log({
      tenantId,
      actor: { id: clientId, type: "client", email },
      action: "CLIENT_LOGIN_SUCCESS",
      entity: { collection: "clients", id: clientId },
      ip,
      requestId,
    });

    return {
      accessToken,
      expiresIn,
      rawRefreshToken,
      clientAccount: {
        id: clientId,
        email: client.portalAccess.email,
        name: client.contactPerson || client.clientName,
        clientId,
      },
    };
  }

  /**
   * Refresh Token Rotation with Reuse Detection and Race Grace Window
   */
  async refresh(params: {
    rawRefreshToken?: string;
    expectedRealm?: "user" | "client";
    origin?: string;
    ip?: string;
    requestId?: string;
  }) {
    const { rawRefreshToken, expectedRealm, origin, ip, requestId } = params;
    this.validateOrigin(origin);

    if (!rawRefreshToken) {
      throw new AppError(ErrorCode.UNAUTHENTICATED, "Refresh token is required", 401);
    }

    const tokenHash = TokenService.hashRefreshToken(rawRefreshToken);
    const existing = await this.refreshTokenRepo.findByTokenHash(tokenHash);

    if (!existing) {
      throw new AppError(ErrorCode.UNAUTHENTICATED, "Invalid refresh token", 401);
    }

    if (expectedRealm && existing.realm !== expectedRealm) {
      throw new AppError(
        ErrorCode.UNAUTHENTICATED,
        `Refresh token realm mismatch (expected '${expectedRealm}')`,
        401
      );
    }

    if (existing.expiresAt < new Date()) {
      throw new AppError(ErrorCode.TOKEN_EXPIRED, "Refresh token has expired", 401);
    }

    // Reuse detection logic
    if (existing.revokedAt) {
      const elapsedMs = Date.now() - existing.revokedAt.getTime();
      if (elapsedMs < 10000) {
        // Parallel tab refresh race: Return 409 REFRESH_RACE without revoking the family
        throw new AppError(
          ErrorCode.REFRESH_RACE,
          "Refresh token race detected; please retry with the latest token",
          409
        );
      }

      // Hard reuse: Revoke entire family and audit
      await this.refreshTokenRepo.revokeFamily(existing.familyId);
      await StatusCacheService.invalidate(
        existing.realm,
        existing.tenantId,
        String(existing.subjectId)
      );

      await this.auditService.log({
        tenantId: existing.tenantId,
        actor: {
          id: String(existing.subjectId),
          type: existing.realm === "user" ? "user" : "client",
        },
        action: "TOKEN_REUSE_DETECTED",
        entity: { collection: "refreshTokens", id: existing.familyId },
        before: { familyId: existing.familyId, tokenHash },
        ip,
        requestId,
      });

      throw new AppError(
        ErrorCode.TOKEN_REUSE_DETECTED,
        "Token reuse detected. All sessions in this family have been terminated.",
        401
      );
    }

    // Verify account status before issuing new tokens
    let role: "admin" | "supervisor" | undefined;
    let clientId: string | undefined;

    if (existing.realm === "user") {
      const user = await this.userRepo.findById(
        existing.tenantId,
        String(existing.subjectId)
      );
      if (!user || user.status !== "active") {
        throw new AppError(ErrorCode.ACCOUNT_LOCKED, "Account is inactive or locked", 403);
      }
      role = user.role;
    } else {
      const client = await this.clientRepo.findById(
        existing.tenantId,
        String(existing.subjectId)
      );
      if (!client || client.portalAccess?.status !== "active") {
        throw new AppError(ErrorCode.ACCOUNT_LOCKED, "Account is inactive or locked", 403);
      }
      clientId = String(client._id);
    }

    // Rotate: Issue new refresh token in the same family and revoke previous one
    const newRawRefreshToken = TokenService.generateRefreshToken();
    const newTokenHash = TokenService.hashRefreshToken(newRawRefreshToken);
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.refreshTokenRepo.rotateToken(tokenHash, {
      tenantId: existing.tenantId,
      realm: existing.realm,
      subjectId: existing.subjectId,
      familyId: existing.familyId,
      tokenHash: newTokenHash,
      expiresAt: refreshExpiresAt,
    });

    const { token: accessToken, expiresIn } = TokenService.generateAccessToken({
      subjectId: String(existing.subjectId),
      realm: existing.realm,
      tenantId: existing.tenantId,
      role,
      clientId,
      ...(existing.realm === "client" ? { clientAccountId: String(existing.subjectId) } : {}),
    });

    await this.auditService.log({
      tenantId: existing.tenantId,
      actor: {
        id: String(existing.subjectId),
        type: existing.realm === "user" ? "user" : "client",
      },
      action: "TOKEN_ROTATED",
      entity: { collection: "refreshTokens", id: existing.familyId },
      ip,
      requestId,
    });

    return {
      accessToken,
      expiresIn,
      newRawRefreshToken,
    };
  }

  /**
   * Logout (revokes current session refresh token)
   */
  async logout(params: {
    rawRefreshToken?: string;
    origin?: string;
    ip?: string;
    requestId?: string;
  }) {
    const { rawRefreshToken, origin, ip, requestId } = params;
    this.validateOrigin(origin);

    if (rawRefreshToken) {
      const tokenHash = TokenService.hashRefreshToken(rawRefreshToken);
      const token = await this.refreshTokenRepo.findByTokenHash(tokenHash);
      if (token && !token.revokedAt) {
        await this.refreshTokenRepo.update(token.tenantId, String(token._id), {
          revokedAt: new Date(),
        });
        await this.auditService.log({
          tenantId: token.tenantId,
          actor: {
            id: String(token.subjectId),
            type: token.realm === "user" ? "user" : "client",
          },
          action: "LOGOUT",
          entity: { collection: "refreshTokens", id: String(token._id) },
          ip,
          requestId,
        });
      }
    }
  }

  /**
   * Logout from all devices
   */
  async logoutAll(params: {
    tenantId: string;
    realm: "user" | "client";
    subjectId: string;
    ip?: string;
    requestId?: string;
  }) {
    const { tenantId, realm, subjectId, ip, requestId } = params;

    await this.refreshTokenRepo.revokeAllForSubject(tenantId, realm, subjectId);
    await StatusCacheService.invalidate(realm, tenantId, subjectId);

    await this.auditService.log({
      tenantId,
      actor: { id: subjectId, type: realm === "user" ? "user" : "client" },
      action: "LOGOUT_ALL",
      entity: { collection: "refreshTokens", id: subjectId },
      ip,
      requestId,
    });
  }

  /**
   * Change Password (revokes all other active sessions)
   */
  async changePassword(params: {
    tenantId: string;
    realm: "user" | "client";
    subjectId: string;
    currentPassword: string;
    newPassword: string;
    ip?: string;
    requestId?: string;
  }) {
    const {
      tenantId,
      realm,
      subjectId,
      currentPassword,
      newPassword,
      ip,
      requestId,
    } = params;

    validatePasswordPolicy(newPassword);

    if (realm === "user") {
      const user = await this.userRepo.findById(tenantId, subjectId);
      if (!user) throw new AppError(ErrorCode.NOT_FOUND, "User not found", 404);

      const matches = await comparePassword(currentPassword, user.passwordHash);
      if (!matches) {
        throw new AppError(ErrorCode.INVALID_CREDENTIALS, "Current password does not match", 400);
      }

      const newHash = await hashPassword(newPassword);
      await this.userRepo.update(tenantId, subjectId, { passwordHash: newHash });
    } else {
      const client = await this.clientRepo.findById(tenantId, subjectId, true);
      if (!client || !client.portalAccess?.passwordHash) {
        throw new AppError(ErrorCode.NOT_FOUND, "Account not found", 404);
      }

      const matches = await comparePassword(currentPassword, client.portalAccess.passwordHash);
      if (!matches) {
        throw new AppError(ErrorCode.INVALID_CREDENTIALS, "Current password does not match", 400);
      }

      const newHash = await hashPassword(newPassword);
      await this.clientRepo.update(tenantId, subjectId, {
        "portalAccess.passwordHash": newHash,
      } as any);
    }

    // Revoke all existing sessions across all devices
    await this.refreshTokenRepo.revokeAllForSubject(tenantId, realm, subjectId);
    await StatusCacheService.invalidate(realm, tenantId, subjectId);

    await this.auditService.log({
      tenantId,
      actor: { id: subjectId, type: realm === "user" ? "user" : "client" },
      action: "PASSWORD_CHANGED",
      entity: { collection: realm === "user" ? "users" : "clients", id: subjectId },
      ip,
      requestId,
    });
  }

  /**
   * Accept Client Invitation Flow
   */
  async acceptInvite(params: {
    token: string;
    password: string;
    ip?: string;
    requestId?: string;
  }) {
    const { token, password, ip, requestId } = params;
    const claims = TokenService.verifyInviteToken(token);

    validatePasswordPolicy(password);
    const passwordHash = await hashPassword(password);

    const updated = await this.clientRepo.acceptInvite(
      claims.tenantId,
      claims.sub,
      passwordHash
    );

    await StatusCacheService.setStatus(
      "client",
      claims.tenantId,
      claims.sub,
      "active",
      60
    );

    await this.auditService.log({
      tenantId: claims.tenantId,
      actor: {
        id: String(updated._id),
        type: "client",
        email: updated.portalAccess?.email,
      },
      action: "CLIENT_INVITE_ACCEPTED",
      entity: { collection: "clients", id: String(updated._id) },
      ip,
      requestId,
    });

    return {
      success: true,
      account: {
        id: String(updated._id),
        email: updated.portalAccess?.email,
        name: updated.contactPerson || updated.clientName,
        clientId: String(updated._id),
      },
    };
  }
}
