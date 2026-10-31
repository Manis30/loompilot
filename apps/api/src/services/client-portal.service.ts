import { ClientRepository } from "../repositories/client.repository.js";
import { RefreshTokenRepository } from "../repositories/refresh-token.repository.js";
import { AuditService } from "./audit.service.js";
import { StatusCacheService } from "./status-cache.service.js";
import { TokenService } from "./token.service.js";
import { AppError } from "../errors/app-error.js";
import { ErrorCode } from "@loompilot/shared";

/**
 * Stage 3.5 Step 3: ClientPortalService
 *
 * Operates on the Client domain model with embedded portalAccess subdocument.
 * Strictly avoids leaking portalAccess.passwordHash.
 */
export class ClientPortalService {
  constructor(
    private readonly clientRepo = new ClientRepository(),
    private readonly refreshTokenRepo = new RefreshTokenRepository(),
    private readonly auditService = new AuditService()
  ) {}

  async listAccounts(tenantId: string) {
    const clients = await this.clientRepo.find(tenantId, {
      "portalAccess.email": { $exists: true },
    });
    return clients.map((c) => ({
      _id: c._id,
      id: String(c._id),
      clientId: c._id,
      email: c.portalAccess?.email || c.email,
      name: c.contactPerson || c.clientName,
      status: c.portalAccess?.status || "invited",
      invitedBy: c.portalAccess?.invitedBy,
      invitedAt: c.portalAccess?.invitedAt,
      acceptedAt: c.portalAccess?.acceptedAt,
    }));
  }

  async getAccountById(tenantId: string, clientId: string) {
    const client = await this.clientRepo.findById(tenantId, clientId);
    if (!client || !client.portalAccess?.email) {
      throw new AppError(ErrorCode.NOT_FOUND, "Client account not found", 404);
    }
    return {
      _id: client._id,
      id: String(client._id),
      clientId: client._id,
      email: client.portalAccess.email,
      name: client.contactPerson || client.clientName,
      status: client.portalAccess.status,
      invitedBy: client.portalAccess.invitedBy,
      invitedAt: client.portalAccess.invitedAt,
      acceptedAt: client.portalAccess.acceptedAt,
    };
  }

  async inviteClientAccount(params: {
    tenantId: string;
    actorUserId: string;
    clientId: string;
    email: string;
    name?: string;
    phone?: string;
    ip?: string;
    requestId?: string;
  }) {
    const { tenantId, actorUserId, clientId, email, name, phone, ip, requestId } = params;

    // Check if another client already uses this portal email
    const existing = await this.clientRepo.findByPortalEmail(tenantId, email);
    if (existing && String(existing._id) !== clientId) {
      throw new AppError(
        ErrorCode.DUPLICATE,
        `Client portal account with email '${email}' already exists`,
        409
      );
    }

    const now = new Date();
    const updated = await this.clientRepo.invitePortal(
      tenantId,
      clientId,
      email,
      actorUserId,
      now
    );

    // If name or phone provided, optionally update client record
    const clientUpdates: Record<string, any> = {};
    if (name && !updated.contactPerson) clientUpdates.contactPerson = name;
    if (phone && !updated.phone) clientUpdates.phone = phone;
    if (Object.keys(clientUpdates).length > 0) {
      await this.clientRepo.update(tenantId, clientId, clientUpdates);
    }

    const inviteToken = TokenService.generateInviteToken({
      clientId: String(updated._id),
      tenantId,
      email: updated.portalAccess?.email,
      invitedAtMs: now.getTime(),
    });

    await this.auditService.log({
      tenantId,
      actor: { id: actorUserId, type: "user" },
      action: "CLIENT_PORTAL_INVITED",
      entity: { collection: "clients", id: String(updated._id) },
      after: { clientId: String(updated._id), email: updated.portalAccess?.email },
      ip,
      requestId,
    });

    return {
      account: {
        _id: updated._id,
        id: String(updated._id),
        clientId: updated._id,
        email: updated.portalAccess?.email,
        name: updated.contactPerson || updated.clientName,
        status: updated.portalAccess?.status,
        invitedBy: updated.portalAccess?.invitedBy,
        invitedAt: updated.portalAccess?.invitedAt,
      },
      inviteToken,
      inviteLink: `/client/accept-invite?token=${inviteToken}`,
    };
  }

  async reinviteClientAccount(params: {
    tenantId: string;
    actorUserId: string;
    clientId: string;
    ip?: string;
    requestId?: string;
  }) {
    const { tenantId, actorUserId, clientId, ip, requestId } = params;
    const client = await this.clientRepo.findById(tenantId, clientId);
    if (!client) throw new AppError(ErrorCode.NOT_FOUND, "Client not found", 404);

    const now = new Date();
    const updated = await this.clientRepo.reinvitePortal(tenantId, clientId, actorUserId, now);

    await this.refreshTokenRepo.revokeAllForSubject(tenantId, "client", clientId);
    await StatusCacheService.invalidate("client", tenantId, clientId);

    const inviteToken = TokenService.generateInviteToken({
      clientId,
      tenantId,
      email: updated.portalAccess?.email,
      invitedAtMs: now.getTime(),
    });

    await this.auditService.log({
      tenantId,
      actor: { id: actorUserId, type: "user" },
      action: "CLIENT_PORTAL_REINVITED",
      entity: { collection: "clients", id: clientId },
      ip,
      requestId,
    });

    return {
      account: {
        _id: updated._id,
        id: String(updated._id),
        clientId: updated._id,
        email: updated.portalAccess?.email,
        name: updated.contactPerson || updated.clientName,
        status: updated.portalAccess?.status,
        invitedBy: updated.portalAccess?.invitedBy,
        invitedAt: updated.portalAccess?.invitedAt,
      },
      inviteToken,
      inviteLink: `/client/accept-invite?token=${inviteToken}`,
    };
  }

  async lockClientAccount(params: {
    tenantId: string;
    actorUserId: string;
    clientId: string;
    ip?: string;
    requestId?: string;
  }) {
    const { tenantId, actorUserId, clientId, ip, requestId } = params;
    const updated = await this.clientRepo.lockPortal(tenantId, clientId);

    await this.refreshTokenRepo.revokeAllForSubject(tenantId, "client", clientId);
    await StatusCacheService.invalidate("client", tenantId, clientId);

    await this.auditService.log({
      tenantId,
      actor: { id: actorUserId, type: "user" },
      action: "CLIENT_PORTAL_LOCKED",
      entity: { collection: "clients", id: clientId },
      ip,
      requestId,
    });

    return {
      _id: updated._id,
      id: String(updated._id),
      clientId: updated._id,
      email: updated.portalAccess?.email,
      name: updated.contactPerson || updated.clientName,
      status: updated.portalAccess?.status,
    };
  }

  async unlockClientAccount(params: {
    tenantId: string;
    actorUserId: string;
    clientId: string;
    ip?: string;
    requestId?: string;
  }) {
    const { tenantId, actorUserId, clientId, ip, requestId } = params;
    const updated = await this.clientRepo.unlockPortal(tenantId, clientId);

    // Purge cached locked status and restore active in status cache
    await StatusCacheService.invalidate("client", tenantId, clientId);
    await StatusCacheService.setStatus("client", tenantId, clientId, "active", 60);

    await this.auditService.log({
      tenantId,
      actor: { id: actorUserId, type: "user" },
      action: "CLIENT_PORTAL_UNLOCKED",
      entity: { collection: "clients", id: clientId },
      ip,
      requestId,
    });

    return {
      _id: updated._id,
      id: String(updated._id),
      clientId: updated._id,
      email: updated.portalAccess?.email,
      name: updated.contactPerson || updated.clientName,
      status: updated.portalAccess?.status,
    };
  }

  async getProfile(tenantId: string, clientId: string) {
    const client = await this.clientRepo.findById(tenantId, clientId);
    if (!client) throw new AppError(ErrorCode.NOT_FOUND, "Client not found", 404);

    return {
      _id: client._id,
      id: String(client._id),
      clientId: client._id,
      email: client.portalAccess?.email || client.email,
      name: client.contactPerson || client.clientName,
      phone: client.phone,
      clientName: client.clientName,
      customerType: client.customerType,
      city: client.city,
      country: client.country,
      status: client.portalAccess?.status || client.status,
      notificationPrefs: client.portalAccess?.notificationPrefs,
    };
  }

  async updateProfile(
    tenantId: string,
    clientId: string,
    updates: { name?: string; phone?: string; notificationPrefs?: any }
  ) {
    const patch: Record<string, any> = {};
    if (updates.name !== undefined) patch.contactPerson = updates.name;
    if (updates.phone !== undefined) patch.phone = updates.phone;
    if (updates.notificationPrefs !== undefined) {
      patch["portalAccess.notificationPrefs"] = updates.notificationPrefs;
    }

    const updated = await this.clientRepo.update(tenantId, clientId, patch);
    if (!updated) throw new AppError(ErrorCode.NOT_FOUND, "Client not found", 404);

    return {
      _id: updated._id,
      id: String(updated._id),
      clientId: updated._id,
      email: updated.portalAccess?.email || updated.email,
      name: updated.contactPerson || updated.clientName,
      phone: updated.phone,
      clientName: updated.clientName,
      customerType: updated.customerType,
      city: updated.city,
      country: updated.country,
      status: updated.portalAccess?.status || updated.status,
      notificationPrefs: updated.portalAccess?.notificationPrefs,
    };
  }
}
