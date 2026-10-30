import { getEnv } from "../config/env.js";
import { AppError } from "../errors/app-error.js";
import { ErrorCode } from "@loompilot/shared";
import { TokenService } from "./token.service.js";
import { UserRepository } from "../repositories/user.repository.js";
import { ClientAccountRepository } from "../repositories/client-account.repository.js";
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
    private readonly clientAccountRepo = new ClientAccountRepository(),
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
      if (lockedUntil && lockedUntil > new Date()) {
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
    const account = await this.clientAccountRepo.findByEmail(tenantId, email);

    if (!account) {
      await runDummyHash(password);
      await this.auditService.log({
        tenantId,
        actor: { id: null, type: "system", email },
        action: "CLIENT_LOGIN_FAILED",
        entity: { collection: "clientAccounts", id: "unknown" },
        ip,
        requestId,
      });
      throw new AppError(ErrorCode.INVALID_CREDENTIALS, "Invalid email or password", 401);
    }

    if (account.status === "invited") {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        "Account invitation has not been accepted yet. Please use the invitation link sent to your email.",
        403
      );
    }

    const accountId = String(account._id);

    if (account.status === "locked") {
      const lockedUntil = account.lockout?.lockedUntil;
      if (lockedUntil && lockedUntil > new Date()) {
        await this.auditService.log({
          tenantId,
          actor: { id: accountId, type: "client", email },
          action: "CLIENT_LOGIN_LOCKED_ATTEMPT",
          entity: { collection: "clientAccounts", id: accountId },
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
      await this.clientAccountRepo.resetLockout(tenantId, accountId);
    }

    if (!account.passwordHash) {
      throw new AppError(ErrorCode.INVALID_CREDENTIALS, "Invalid email or password", 401);
    }

    const isMatch = await comparePassword(password, account.passwordHash);

    if (!isMatch) {
      const env = getEnv();
      const { lockedNow } = await this.clientAccountRepo.incrementFailedLogin(
        tenantId,
        accountId,
        env.LOCKOUT_THRESHOLD,
        env.LOCKOUT_DURATION_MINUTES
      );

      if (lockedNow) {
        await StatusCacheService.invalidate("client", tenantId, accountId);
        await this.refreshTokenRepo.revokeAllForSubject(
          tenantId,
          "client",
          accountId
        );
        await this.auditService.log({
          tenantId,
          actor: { id: accountId, type: "client", email },
          action: "CLIENT_ACCOUNT_LOCKED",
          entity: { collection: "clientAccounts", id: accountId },
          ip,
          requestId,
        });
      }

      await this.auditService.log({
        tenantId,
        actor: { id: accountId, type: "client", email },
        action: "CLIENT_LOGIN_FAILED",
        entity: { collection: "clientAccounts", id: accountId },
        ip,
        requestId,
      });

      throw new AppError(ErrorCode.INVALID_CREDENTIALS, "Invalid email or password", 401);
    }

    // Reset failed login count
    await this.clientAccountRepo.resetLockout(tenantId, accountId);

    const { token: accessToken, expiresIn } = TokenService.generateAccessToken({
      subjectId: accountId,
      realm: "client",
      tenantId,
      clientId: String(account.clientId),
      clientAccountId: accountId,
    });

    const rawRefreshToken = TokenService.generateRefreshToken();
    const tokenHash = TokenService.hashRefreshToken(rawRefreshToken);
    const familyId = crypto.randomUUID();
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.refreshTokenRepo.createToken({
      tenantId,
      realm: "client",
      subjectId: accountId,
      familyId,
      tokenHash,
      expiresAt: refreshExpiresAt,
    });

    await StatusCacheService.setStatus("client", tenantId, accountId, "active", 60);

    await this.auditService.log({
      tenantId,
      actor: { id: accountId, type: "client", email },
      action: "CLIENT_LOGIN_SUCCESS",
      entity: { collection: "clientAccounts", id: accountId },
      ip,
      requestId,
    });

    return {
      accessToken,
      expiresIn,
      rawRefreshToken,
      clientAccount: {
        id: accountId,
        email: account.email,
        name: account.name,
        clientId: String(account.clientId),
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
      const account = await this.clientAccountRepo.findById(
        existing.tenantId,
        String(existing.subjectId)
      );
      if (!account || account.status !== "active") {
        throw new AppError(ErrorCode.ACCOUNT_LOCKED, "Account is inactive or locked", 403);
      }
      clientId = String(account.clientId);
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
      const account = await this.clientAccountRepo.findById(tenantId, subjectId);
      if (!account || !account.passwordHash) {
        throw new AppError(ErrorCode.NOT_FOUND, "Account not found", 404);
      }

      const matches = await comparePassword(currentPassword, account.passwordHash);
      if (!matches) {
        throw new AppError(ErrorCode.INVALID_CREDENTIALS, "Current password does not match", 400);
      }

      const newHash = await hashPassword(newPassword);
      await this.clientAccountRepo.update(tenantId, subjectId, { passwordHash: newHash });
    }

    // Revoke all existing sessions across all devices
    await this.refreshTokenRepo.revokeAllForSubject(tenantId, realm, subjectId);
    await StatusCacheService.invalidate(realm, tenantId, subjectId);

    await this.auditService.log({
      tenantId,
      actor: { id: subjectId, type: realm === "user" ? "user" : "client" },
      action: "PASSWORD_CHANGED",
      entity: { collection: realm === "user" ? "users" : "clientAccounts", id: subjectId },
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

    const account = await this.clientAccountRepo.findById(
      claims.tenantId,
      claims.sub
    );

    if (!account) {
      throw new AppError(ErrorCode.NOT_FOUND, "Invited account does not exist", 404);
    }

    if (account.status !== "invited") {
      throw new AppError(
        ErrorCode.INVITE_ALREADY_ACCEPTED,
        "Invitation has already been accepted or is no longer valid",
        400
      );
    }

    validatePasswordPolicy(password);
    const passwordHash = await hashPassword(password);

    const updated = await this.clientAccountRepo.update(
      claims.tenantId,
      claims.sub,
      {
        passwordHash,
        status: "active",
      }
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
      actor: { id: String(account._id), type: "client", email: account.email },
      action: "CLIENT_INVITE_ACCEPTED",
      entity: { collection: "clientAccounts", id: String(account._id) },
      ip,
      requestId,
    });

    return {
      success: true,
      account: {
        id: String(updated?._id),
        email: updated?.email,
        name: updated?.name,
        clientId: String(updated?.clientId),
      },
    };
  }
}
