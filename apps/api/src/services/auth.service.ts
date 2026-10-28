import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { IUserRepository, User } from "../interfaces/user.repository.js";
import { IAuditLogRepository } from "../interfaces/audit-log.js";
import { LoginInput, RegisterUserInput } from "../validators/auth.validator.js";
import { UnauthorizedError, ConflictError, NotFoundError } from "../errors/index.js";
import { env } from "../config/env.js";

export interface AuthResult {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  constructor(
    private readonly users: IUserRepository,
    private readonly audit?: IAuditLogRepository
  ) {}

  async register(input: RegisterUserInput): Promise<User> {
    const existing = await this.users.findByEmail(input.tenantId, input.email);
    if (existing) {
      throw new ConflictError(`User with email ${input.email} already exists`);
    }

    const salt = await bcrypt.genSalt(10);
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
        userId: user.id,
        userRole: user.role,
        action: "USER_REGISTERED",
        entity: "user",
        entityId: user.id,
      });
    }

    return user;
  }

  async login(input: LoginInput): Promise<AuthResult> {
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

    const refreshToken = jwt.sign(
      { userId: user.id, tenantId: user.tenantId },
      env.JWT_REFRESH_SECRET,
      { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any }
    );

    await this.users.addRefreshToken(user.tenantId, user.id, refreshToken);

    if (this.audit) {
      await this.audit.record({
        tenantId: user.tenantId,
        userId: user.id,
        userRole: user.role,
        action: "USER_LOGIN",
        entity: "user",
        entityId: user.id,
      });
    }

    return { user, accessToken, refreshToken };
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as {
        userId: string;
        tenantId: string;
      };

      const user = await this.users.findById(decoded.tenantId, decoded.userId);
      if (!user || !user.isActive || !user.refreshTokens.includes(refreshToken)) {
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
        { userId: user.id, tenantId: user.tenantId },
        env.JWT_REFRESH_SECRET,
        { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any }
      );

      await this.users.replaceRefreshToken(
        user.tenantId,
        user.id,
        refreshToken,
        newRefreshToken
      );

      return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    } catch {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }
  }

  async logout(tenantId: string, userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await this.users.removeRefreshToken(tenantId, userId, refreshToken);
    }
  }

  async getById(tenantId: string, id: string): Promise<User> {
    const user = await this.users.findById(tenantId, id);
    if (!user) throw new NotFoundError("User not found");
    return user;
  }
}

