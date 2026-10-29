import crypto from "crypto";
import bcrypt from "bcryptjs";
import { IUserRepository, User } from "../interfaces/user.repository.js";
import { IAuditLogRepository } from "../interfaces/audit-log.js";
import { Actor } from "../utils/actor.js";
import {
  CreateUserInput,
  UpdateUserInput,
  ResetPasswordInput,
} from "../validators/user.validator.js";
import {
  NotFoundError,
  ConflictError,
  ForbiddenError,
} from "../errors/index.js";
import { UserRole } from "@loompilot/shared";

export class UserService {
  constructor(
    private readonly users: IUserRepository,
    private readonly audit?: IAuditLogRepository
  ) {}

  async list(actor: Actor): Promise<User[]> {
    return this.users.list(actor.tenantId);
  }

  async getById(actor: Actor, id: string): Promise<User> {
    const user = await this.users.findById(actor.tenantId, id);
    if (!user) throw new NotFoundError("User not found");
    return user;
  }

  async create(actor: Actor, input: CreateUserInput): Promise<User> {
    const existing = await this.users.findByEmail(actor.tenantId, input.email);
    if (existing) {
      throw new ConflictError(`User with email ${input.email} already exists`);
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(input.password, salt);

    const user = await this.users.create({
      tenantId: actor.tenantId,
      email: input.email.toLowerCase().trim(),
      name: input.name.trim(),
      passwordHash,
      role: input.role,
      isActive: true,
    });

    if (this.audit) {
      await this.audit.record({
        tenantId: actor.tenantId,
        actorId: actor.userId,
        actorRole: actor.role,
        action: "USER_CREATED",
        entityType: "user",
        entityId: user.id,
        after: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isActive: user.isActive,
        },
      });
    }

    return user;
  }

  async update(
    actor: Actor,
    id: string,
    input: UpdateUserInput
  ): Promise<User> {
    const user = await this.users.findById(actor.tenantId, id);
    if (!user) throw new NotFoundError("User not found");

    const beforeSnapshot = {
      name: user.name,
      role: user.role,
      isActive: user.isActive,
    };

    // Owner protection rule: An owner cannot deactivate or demote themselves/another if they are the last active owner
    if (user.role === UserRole.OWNER) {
      const isDemotion = input.role !== undefined && input.role !== UserRole.OWNER;
      const isDeactivation = input.isActive === false;

      if (isDemotion || isDeactivation) {
        const activeOwners = await this.users.countActiveOwners(actor.tenantId);
        if (activeOwners <= 1) {
          throw new ForbiddenError(
            "Cannot deactivate or demote the last active owner of the tenant"
          );
        }
      }
    }

    const updates: Partial<User> = {};
    if (input.name !== undefined) updates.name = input.name.trim();
    if (input.role !== undefined) updates.role = input.role;
    if (input.isActive !== undefined) updates.isActive = input.isActive;

    const updated = await this.users.update(actor.tenantId, id, updates);
    if (!updated) throw new NotFoundError("User not found");

    const action = input.isActive === false ? "USER_DEACTIVATED" : "USER_UPDATED";

    if (this.audit) {
      await this.audit.record({
        tenantId: actor.tenantId,
        actorId: actor.userId,
        actorRole: actor.role,
        action,
        entityType: "user",
        entityId: updated.id,
        before: beforeSnapshot,
        after: {
          name: updated.name,
          role: updated.role,
          isActive: updated.isActive,
        },
      });
    }

    return updated;
  }

  async resetPassword(
    actor: Actor,
    id: string,
    input?: ResetPasswordInput
  ): Promise<{ temporaryPassword?: string }> {
    const user = await this.users.findById(actor.tenantId, id);
    if (!user) throw new NotFoundError("User not found");

    let finalPassword = input?.newPassword;
    let temporaryPassword: string | undefined = undefined;

    if (!finalPassword) {
      temporaryPassword = `Tmp_${crypto.randomBytes(6).toString("hex")}!9`;
      finalPassword = temporaryPassword;
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(finalPassword, salt);

    await this.users.update(actor.tenantId, id, { passwordHash });

    if (this.audit) {
      await this.audit.record({
        tenantId: actor.tenantId,
        actorId: actor.userId,
        actorRole: actor.role,
        action: "USER_PASSWORD_RESET",
        entityType: "user",
        entityId: id,
        after: { resetBy: actor.userId },
      });
    }

    return temporaryPassword ? { temporaryPassword } : {};
  }
}

