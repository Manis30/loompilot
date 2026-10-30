import { ClientAccountRepository } from "../repositories/client-account.repository.js";
import { RefreshTokenRepository } from "../repositories/refresh-token.repository.js";
import { AuditService } from "./audit.service.js";
import { StatusCacheService } from "./status-cache.service.js";
import { TokenService } from "./token.service.js";
import { AppError } from "../errors/app-error.js";
import { ErrorCode } from "@loompilot/shared";

export class ClientAccountService {
  constructor(
    private readonly clientAccountRepo = new ClientAccountRepository(),
    private readonly refreshTokenRepo = new RefreshTokenRepository(),
    private readonly auditService = new AuditService()
  ) {}

  async listAccounts(tenantId: string) {
    return this.clientAccountRepo.find(tenantId, {});
  }

  async getAccountById(tenantId: string, accountId: string) {
    const account = await this.clientAccountRepo.findById(tenantId, accountId);
    if (!account) throw new AppError(ErrorCode.NOT_FOUND, "Client account not found", 404);
    return account;
  }

  async inviteClientAccount(params: {
    tenantId: string;
    actorUserId: string;
    clientId: string;
    email: string;
    name: string;
    phone?: string;
    ip?: string;
    requestId?: string;
  }) {
    const { tenantId, actorUserId, clientId, email, name, phone, ip, requestId } = params;

    const existing = await this.clientAccountRepo.findByEmail(tenantId, email);
    if (existing) {
      throw new AppError(
        ErrorCode.DUPLICATE,
        `Client account with email '${email}' already exists`,
        409
      );
    }

    const created = await this.clientAccountRepo.createAccount(tenantId, {
      clientId,
      email: email.toLowerCase().trim(),
      name: name.trim(),
      phone: phone?.trim(),
      status: "invited",
      invitedBy: actorUserId,
      invitedAt: new Date(),
    });

    const inviteToken = TokenService.generateInviteToken({
      accountId: String(created._id),
      tenantId,
    });

    await this.auditService.log({
      tenantId,
      actor: { id: actorUserId, type: "user" },
      action: "CLIENT_ACCOUNT_INVITED",
      entity: { collection: "clientAccounts", id: String(created._id) },
      after: { clientId, email, name },
      ip,
      requestId,
    });

    return {
      account: created,
      inviteToken,
      inviteLink: `/client/accept-invite?token=${inviteToken}`,
    };
  }

  async reinviteClientAccount(params: {
    tenantId: string;
    actorUserId: string;
    accountId: string;
    ip?: string;
    requestId?: string;
  }) {
    const { tenantId, actorUserId, accountId, ip, requestId } = params;
    const account = await this.clientAccountRepo.findById(tenantId, accountId);
    if (!account) throw new AppError(ErrorCode.NOT_FOUND, "Client account not found", 404);

    // Return to invited status, revoke sessions
    const updated = await this.clientAccountRepo.update(tenantId, accountId, {
      status: "invited",
      invitedBy: actorUserId as any,
      invitedAt: new Date(),
      passwordHash: undefined,
    });

    await this.refreshTokenRepo.revokeAllForSubject(tenantId, "client", accountId);
    await StatusCacheService.invalidate("client", tenantId, accountId);

    const inviteToken = TokenService.generateInviteToken({
      accountId,
      tenantId,
    });

    await this.auditService.log({
      tenantId,
      actor: { id: actorUserId, type: "user" },
      action: "CLIENT_ACCOUNT_REINVITED",
      entity: { collection: "clientAccounts", id: accountId },
      ip,
      requestId,
    });

    return {
      account: updated,
      inviteToken,
      inviteLink: `/client/accept-invite?token=${inviteToken}`,
    };
  }

  async lockClientAccount(params: {
    tenantId: string;
    actorUserId: string;
    accountId: string;
    ip?: string;
    requestId?: string;
  }) {
    const { tenantId, actorUserId, accountId, ip, requestId } = params;
    const updated = await this.clientAccountRepo.updateStatus(
      tenantId,
      accountId,
      "locked"
    );

    await this.refreshTokenRepo.revokeAllForSubject(tenantId, "client", accountId);
    await StatusCacheService.invalidate("client", tenantId, accountId);

    await this.auditService.log({
      tenantId,
      actor: { id: actorUserId, type: "user" },
      action: "CLIENT_ACCOUNT_LOCKED",
      entity: { collection: "clientAccounts", id: accountId },
      ip,
      requestId,
    });

    return updated;
  }

  async unlockClientAccount(params: {
    tenantId: string;
    actorUserId: string;
    accountId: string;
    ip?: string;
    requestId?: string;
  }) {
    const { tenantId, actorUserId, accountId, ip, requestId } = params;
    const updated = await this.clientAccountRepo.updateStatus(
      tenantId,
      accountId,
      "active"
    );

    await StatusCacheService.setStatus("client", tenantId, accountId, "active", 60);

    await this.auditService.log({
      tenantId,
      actor: { id: actorUserId, type: "user" },
      action: "CLIENT_ACCOUNT_UNLOCKED",
      entity: { collection: "clientAccounts", id: accountId },
      ip,
      requestId,
    });

    return updated;
  }

  async getProfile(tenantId: string, accountId: string) {
    const account = await this.clientAccountRepo.findById(tenantId, accountId);
    if (!account) throw new AppError(ErrorCode.NOT_FOUND, "Client account not found", 404);
    const { passwordHash: _hash, lockout: _lockout, ...profile } = account as any;
    return profile;
  }

  async updateProfile(tenantId: string, accountId: string, updates: { name?: string; phone?: string; notificationPrefs?: any }) {
    const updated = await this.clientAccountRepo.update(tenantId, accountId, updates as any);
    if (!updated) throw new AppError(ErrorCode.NOT_FOUND, "Client account not found", 404);
    const { passwordHash: _hash, lockout: _lockout, ...profile } = updated as any;
    return profile;
  }
}
