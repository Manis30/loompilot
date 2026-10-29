import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { IUserRepository, User } from "../interfaces/user.repository.js";
import { IAuditLogRepository } from "../interfaces/audit-log.js";
import { IRefreshTokenRepository } from "../interfaces/refresh-token.repository.js";
import { InMemoryRefreshTokenRepository } from "../repositories/in-memory-refresh-token.repository.js";
import { LoginInput, RegisterUserInput } from "../validators/auth.validator.js";
import { UnauthorizedError, ConflictError, NotFoundError, ForbiddenError } from "../errors/index.js";
import { UserRole } from "@loompilot/shared";
import { Actor } from "../utils/actor.js";
import { env } from "../config/env.js";

export interface AuthResult {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  private readonly refreshTokens: IRefreshTokenRepository;
  private readonly audit?: IAuditLogRepository;

  constructor(
    private readonly users: IUserRepository,
    refreshTokensOrAudit?: IRefreshTokenRepository | IAuditLogRepository,
    audit?: IAuditLogRepository
  ) {
    if (refreshTokensOrAudit && "findByTokenHash" in refreshTokensOrAudit) {
      this.refreshTokens = refreshTokensOrAudit;
      this.audit = audit;
    } else {
      this.refreshTokens = new InMemoryRefreshTokenRepository();
      this.audit = refreshTokensOrAudit as IAuditLogRepository | undefined;
    }
  }

  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  async register(input: RegisterUserInput, actor?: Actor): Promise<User> {
    const totalTenantUsers = await this.users.count(input.tenantId);

    // Bootstrap rule: If tenant has zero users, allow creating the first user ONLY if role is OWNER
    if (totalTenantUsers === 0) {
      if (input.role !== UserRole.OWNER) {
        throw new ForbiddenError("The first user created for a new tenant must have the OWNER role");
      }
    } else {
      // Subsequent user creation requires an authenticated OWNER actor
      if (!actor || actor.role !== UserRole.OWNER || actor.tenantId !== input.tenantId) {
        throw new ForbiddenError("User creation in an existing tenant is restricted to tenant owners");
      }
    }

    const existing = await this.users.findByEmail(input.tenantId, input.email);
    if (existing) {
      throw new ConflictError(`User with email ${input.email} already exists`);
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(input.password, salt);

    const user = await this.users.create({
      tenantId: input.tenantId,
      email: input.email,
      name: input.name,
      passwordHash,
      role: input.role,
      isActive: true,
    });

    if (this.audit) {
      await this.audit.record({
        tenantId: input.tenantId,
        actorId: actor ? actor.userId : user.id,
        actorRole: actor ? actor.role : user.role,
        action: "USER_REGISTERED",
        entityType: "user",
        entityId: user.id,
        after: { email: user.email, role: user.role, name: user.name },
      });
    }

    return user;
  }

  async login(
    input: LoginInput,
    meta?: { ip?: string; userAgent?: string }
  ): Promise<AuthResult> {
    const user = await this.users.findByEmail(input.tenantId, input.email);
    if (!user || !user.isActive) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const isValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const accessToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as any }
    );

    const familyId = crypto.randomUUID();
    const refreshToken = jwt.sign(
      { userId: user.id, tenantId: user.tenantId, jti: crypto.randomUUID(), familyId },
      env.JWT_REFRESH_SECRET,
      { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any }
    );

    const tokenHash = this.hashToken(refreshToken);
    await this.refreshTokens.create({
      tenantId: user.tenantId,
      userId: user.id,
      tokenHash,
      familyId,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    await this.users.addRefreshToken(user.tenantId, user.id, refreshToken);

    if (this.audit) {
      await this.audit.record({
        tenantId: user.tenantId,
        actorId: user.id,
        actorRole: user.role,
        action: "USER_LOGIN",
        entityType: "user",
        entityId: user.id,
        ip: meta?.ip,
        userAgent: meta?.userAgent,
      });
    }

    return { user, accessToken, refreshToken };
  }

  async refresh(
    refreshToken: string,
    meta?: { ip?: string; userAgent?: string }
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenHash = this.hashToken(refreshToken);
    const existing = await this.refreshTokens.findByTokenHash(tokenHash);

    if (!existing) {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }

    if (existing.revoked) {
      // Reuse detection! Revoke entire family
      await this.refreshTokens.revokeFamily(existing.familyId);
      throw new UnauthorizedError("Invalid or expired refresh token");
    }

    if (existing.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }

    await this.refreshTokens.revoke(existing.id);

    const user = await this.users.findById(existing.tenantId, existing.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }

    const newAccessToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as any }
    );

    const newRefreshToken = jwt.sign(
      { userId: user.id, tenantId: user.tenantId, jti: crypto.randomUUID(), familyId: existing.familyId },
      env.JWT_REFRESH_SECRET,
      { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any }
    );

    const newTokenHash = this.hashToken(newRefreshToken);
    await this.refreshTokens.create({
      tenantId: user.tenantId,
      userId: user.id,
      tokenHash: newTokenHash,
      familyId: existing.familyId,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    await this.users.replaceRefreshToken(
      user.tenantId,
      user.id,
      refreshToken,
      newRefreshToken
    );

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  async logout(tenantId: string, userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      const record = await this.refreshTokens.findByTokenHash(tokenHash);
      if (record) {
        await this.refreshTokens.revoke(record.id);
      }
      await this.users.removeRefreshToken(tenantId, userId, refreshToken);
    }
  }

  async logoutAll(tenantId: string, userId: string): Promise<void> {
    await this.refreshTokens.revokeAllForUser(tenantId, userId);
  }

  async changePassword(
    actor: Actor,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await this.users.findById(actor.tenantId, actor.userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedError("Current password is incorrect");
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(newPassword, salt);
    await this.users.update(actor.tenantId, actor.userId, { passwordHash });

    if (this.audit) {
      await this.audit.record({
        tenantId: actor.tenantId,
        actorId: actor.userId,
        actorRole: actor.role,
        action: "PASSWORD_CHANGED",
        entityType: "user",
        entityId: actor.userId,
      });
    }
  }

  async getById(tenantId: string, id: string): Promise<User> {
    const user = await this.users.findById(tenantId, id);
    if (!user) throw new NotFoundError("User not found");
    return user;
  }
}
