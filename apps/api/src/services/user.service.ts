import { UserRepository } from "../repositories/user.repository.js";
import { SettingsRepository } from "../repositories/settings.repository.js";
import { RefreshTokenRepository } from "../repositories/refresh-token.repository.js";
import { AuditService } from "./audit.service.js";
import { StatusCacheService } from "./status-cache.service.js";
import { AppError } from "../errors/app-error.js";
import { ErrorCode } from "@loompilot/shared";
import { hashPassword, validatePasswordPolicy } from "../utils/password.js";
import { IUser } from "../models/identity/user.model.js";
import { PaginationQuery, PaginatedResult } from "../utils/pagination.js";

export interface SafeUserDto {
  id: string;
  _id: string;
  tenantId: string;
  role: "admin" | "supervisor";
  name: string;
  email: string;
  phone?: string;
  processAreas: string[];
  status: "active" | "locked";
  notificationPrefs?: any;
  createdAt?: Date;
  updatedAt?: Date;
}

export function toSafeUserDto(user: any): SafeUserDto {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.passwordHash;
  delete obj.lockout;
  return {
    id: String(obj._id || obj.id),
    _id: String(obj._id || obj.id),
    tenantId: obj.tenantId,
    role: obj.role,
    name: obj.name,
    email: obj.email,
    phone: obj.phone,
    processAreas: obj.processAreas || [],
    status: obj.status,
    notificationPrefs: obj.notificationPrefs,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

export class UserService {
  constructor(
    private readonly userRepo = new UserRepository(),
    private readonly settingsRepo = new SettingsRepository(),
    private readonly refreshTokenRepo = new RefreshTokenRepository(),
    private readonly auditService = new AuditService()
  ) {}

  /**
   * Validates processAreas array against settings.processConfig[].area
   */
  async validateProcessAreas(tenantId: string, processAreas?: string[]): Promise<void> {
    if (!processAreas || processAreas.length === 0) return;

    const settings = await this.settingsRepo.getSettings(tenantId);
    if (!settings || !settings.processConfig || settings.processConfig.length === 0) {
      return; // If no process config configured yet, allow placeholder
    }

    const validAreas = new Set(settings.processConfig.map((p: { area: string }) => p.area.toLowerCase()));
    for (const area of processAreas) {
      if (!validAreas.has(area.toLowerCase())) {
        throw new AppError(
          ErrorCode.VALIDATION_FAILED,
          `Process area '${area}' is invalid. Allowed areas: [${Array.from(validAreas).join(", ")}]`,
          400
        );
      }
    }
  }

  async listUsers(
    tenantId: string,
    pagination?: PaginationQuery,
    filterOptions?: {
      search?: string;
      role?: "admin" | "supervisor";
      status?: "active" | "locked";
      processArea?: string;
    }
  ): Promise<PaginatedResult<SafeUserDto>> {
    const filter: Record<string, any> = {};

    if (filterOptions?.search) {
      const searchRegex = { $regex: filterOptions.search.trim(), $options: "i" };
      filter.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
      ];
    }

    if (filterOptions?.role) {
      filter.role = filterOptions.role;
    }

    if (filterOptions?.status) {
      filter.status = filterOptions.status;
    }

    if (filterOptions?.processArea) {
      filter.processAreas = filterOptions.processArea.trim();
    }

    const defaultPagination: PaginationQuery = {
      page: 1,
      limit: 50,
      sortOrder: "desc",
    };

    const result = await this.userRepo.findPaginated(
      tenantId,
      filter,
      pagination || defaultPagination
    );

    return {
      data: result.data.map(toSafeUserDto),
      meta: result.meta,
    };
  }

  async getUserById(tenantId: string, userId: string): Promise<SafeUserDto> {
    const user = await this.userRepo.findById(tenantId, userId);
    if (!user) throw new AppError(ErrorCode.NOT_FOUND, "User not found", 404);
    return toSafeUserDto(user);
  }

  async createUser(params: {
    tenantId: string;
    actorUserId: string;
    email: string;
    name: string;
    password: string;
    role: "admin" | "supervisor";
    phone?: string;
    processAreas?: string[];
    ip?: string;
    requestId?: string;
  }): Promise<SafeUserDto> {
    const { tenantId, actorUserId, email, name, password, role, phone, processAreas, ip, requestId } = params;

    const existing = await this.userRepo.findByEmail(tenantId, email);
    if (existing) {
      throw new AppError(ErrorCode.DUPLICATE, `User with email '${email}' already exists`, 409);
    }

    await this.validateProcessAreas(tenantId, processAreas);
    validatePasswordPolicy(password);
    const passwordHash = await hashPassword(password);

    const created = await this.userRepo.create(tenantId, {
      name,
      email: email.toLowerCase().trim(),
      phone,
      passwordHash,
      role,
      status: "active",
      processAreas: processAreas || [],
      version: 1,
    });

    await this.auditService.log({
      tenantId,
      actor: { id: actorUserId, type: "user" },
      action: "USER_CREATED",
      entity: { collection: "users", id: String(created._id) },
      after: { name, email, role, processAreas },
      ip,
      requestId,
    });

    return toSafeUserDto(created);
  }

  async updateUser(params: {
    tenantId: string;
    actorUserId: string;
    userId: string;
    name?: string;
    phone?: string;
    role?: "admin" | "supervisor";
    status?: "active" | "locked";
    processAreas?: string[];
    ip?: string;
    requestId?: string;
  }): Promise<SafeUserDto> {
    const { tenantId, actorUserId, userId, name, phone, role, status, processAreas, ip, requestId } = params;

    const existing = await this.userRepo.findById(tenantId, userId);
    if (!existing) throw new AppError(ErrorCode.NOT_FOUND, "User not found", 404);

    // Last Active Admin Protection
    if (existing.role === "admin" && existing.status === "active") {
      const isDemoting = role && role !== "admin";
      const isLocking = status === "locked";

      if (isDemoting || isLocking) {
        const activeAdmins = await this.userRepo.countActiveAdmins(tenantId);
        if (activeAdmins <= 1) {
          throw new AppError(
            ErrorCode.LAST_ADMIN,
            "Cannot lock or demote the last active administrator for this tenant",
            400
          );
        }
      }
    }

    if (processAreas !== undefined) {
      await this.validateProcessAreas(tenantId, processAreas);
    }

    const updates: Partial<IUser> = {};
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (role !== undefined) updates.role = role;
    if (status !== undefined) updates.status = status;
    if (processAreas !== undefined) updates.processAreas = processAreas;

    const updated = await this.userRepo.update(tenantId, userId, updates);
    if (!updated) {
      throw new AppError(ErrorCode.NOT_FOUND, "User not found", 404);
    }

    // If status was locked, revoke all active sessions immediately
    if (status === "locked") {
      await this.refreshTokenRepo.revokeAllForSubject(tenantId, "user", userId);
      await StatusCacheService.invalidate("user", tenantId, userId);
    } else if (role !== undefined) {
      // Invalidate cache so role change takes immediate effect
      await StatusCacheService.invalidate("user", tenantId, userId);
    }

    await this.auditService.log({
      tenantId,
      actor: { id: actorUserId, type: "user" },
      action: "USER_UPDATED",
      entity: { collection: "users", id: userId },
      before: { name: existing.name, role: existing.role, status: existing.status, processAreas: existing.processAreas },
      after: updates,
      ip,
      requestId,
    });

    return toSafeUserDto(updated);
  }

  async lockUser(tenantId: string, actorUserId: string, userId: string, ip?: string, requestId?: string): Promise<SafeUserDto> {
    return this.updateUser({
      tenantId,
      actorUserId,
      userId,
      status: "locked",
      ip,
      requestId,
    });
  }

  async unlockUser(tenantId: string, actorUserId: string, userId: string, ip?: string, requestId?: string): Promise<SafeUserDto> {
    const updated = await this.userRepo.updateStatus(tenantId, userId, "active");
    if (!updated) {
      throw new AppError(ErrorCode.NOT_FOUND, "User not found", 404);
    }
    await StatusCacheService.setStatus("user", tenantId, userId, "active", 60);

    await this.auditService.log({
      tenantId,
      actor: { id: actorUserId, type: "user" },
      action: "USER_UNLOCKED",
      entity: { collection: "users", id: userId },
      ip,
      requestId,
    });

    return toSafeUserDto(updated);
  }

  async getProfile(tenantId: string, userId: string) {
    const user = await this.userRepo.findById(tenantId, userId);
    if (!user) throw new AppError(ErrorCode.NOT_FOUND, "User not found", 404);
    const { passwordHash: _hash, lockout: _lockout, ...profile } = user as any;
    return profile;
  }

  async updateProfile(tenantId: string, userId: string, updates: { name?: string; phone?: string; notificationPrefs?: any }) {
    const updated = await this.userRepo.update(tenantId, userId, updates as any);
    if (!updated) throw new AppError(ErrorCode.NOT_FOUND, "User not found", 404);
    const { passwordHash: _hash, lockout: _lockout, ...profile } = updated as any;
    return profile;
  }
}
