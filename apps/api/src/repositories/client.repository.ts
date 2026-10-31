import mongoose, { Types } from "mongoose";
import { ClientModel, IClient } from "../models/identity/client.model.js";
import { TxContext } from "../interfaces/unit-of-work.interface.js";
import { AppError } from "../errors/app-error.js";
import { ErrorCode } from "@loompilot/shared";
import { PaginationQuery, PaginatedResult, paginate } from "../utils/pagination.js";

/**
 * Stage 3.5 Step 3: ClientRepository
 *
 * Repository for Client entity and its embedded portalAccess authentication subdocument.
 * Strictly maintains select: false on portalAccess.passwordHash.
 */
export class ClientRepository {
  constructor(private readonly model: mongoose.Model<IClient> = ClientModel) {}

  private getSession(tx?: TxContext): mongoose.ClientSession | undefined {
    return tx?.session as mongoose.ClientSession | undefined;
  }

  async findById(
    tenantId: string,
    id: string | Types.ObjectId,
    includePasswordHash = false,
    tx?: TxContext
  ): Promise<IClient | null> {
    if (typeof id === "string" && !mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    const session = this.getSession(tx);
    const query = this.model
      .findOne({ tenantId, _id: id })
      .session(session ?? null);

    if (includePasswordHash) {
      query.select("+portalAccess.passwordHash");
    }

    return query.exec();
  }

  async findByPortalEmail(
    tenantId: string,
    email: string,
    includePasswordHash = false,
    tx?: TxContext
  ): Promise<IClient | null> {
    const session = this.getSession(tx);
    const query = this.model
      .findOne({
        tenantId,
        "portalAccess.email": email.toLowerCase().trim(),
      })
      .session(session ?? null);

    if (includePasswordHash) {
      query.select("+portalAccess.passwordHash");
    }

    return query.exec();
  }

  async findByEmail(
    tenantId: string,
    email: string,
    tx?: TxContext
  ): Promise<IClient | null> {
    const session = this.getSession(tx);
    return this.model
      .findOne({
        tenantId,
        email: email.toLowerCase().trim(),
      })
      .session(session ?? null)
      .exec();
  }

  async findByName(
    tenantId: string,
    clientName: string,
    tx?: TxContext
  ): Promise<IClient | null> {
    const session = this.getSession(tx);
    return this.model
      .findOne({
        tenantId,
        clientName: { $regex: `^${clientName.trim()}$`, $options: "i" },
      })
      .session(session ?? null)
      .exec();
  }

  async findPaginated(
    tenantId: string,
    filter: Record<string, any>,
    pagination: PaginationQuery,
    tx?: TxContext
  ): Promise<PaginatedResult<IClient>> {
    const session = this.getSession(tx);
    const { page, limit, sortBy, sortOrder } = pagination;
    const skip = (page - 1) * limit;
    const sort: Record<string, 1 | -1> = sortBy
      ? { [sortBy]: sortOrder === "asc" ? 1 : -1 }
      : { createdAt: -1 };

    const scopedFilter = { tenantId, ...filter };

    const [items, total] = await Promise.all([
      this.model
        .find(scopedFilter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .session(session ?? null)
        .lean<IClient[]>()
        .exec(),
      this.model
        .countDocuments(scopedFilter)
        .session(session ?? null)
        .exec(),
    ]);

    return paginate(items, total, page, limit);
  }

  async find(
    tenantId: string,
    filter: Record<string, any> = {},
    tx?: TxContext
  ): Promise<IClient[]> {
    const session = this.getSession(tx);
    return this.model
      .find({ tenantId, ...filter })
      .session(session ?? null)
      .sort({ createdAt: -1 })
      .exec();
  }

  async create(
    tenantId: string,
    data: Partial<IClient>,
    tx?: TxContext
  ): Promise<IClient> {
    const session = this.getSession(tx);
    const doc = new this.model({
      ...data,
      tenantId,
    });
    return doc.save({ session });
  }

  async update(
    tenantId: string,
    id: string | Types.ObjectId,
    updates: Partial<IClient>,
    tx?: TxContext
  ): Promise<IClient | null> {
    if (typeof id === "string" && !mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    const session = this.getSession(tx);
    return this.model
      .findOneAndUpdate(
        { tenantId, _id: id },
        { $set: updates, $inc: { version: 1 } },
        { new: true, session: session ?? null }
      )
      .exec();
  }

  async invitePortal(
    tenantId: string,
    clientId: string | Types.ObjectId,
    email: string,
    actorUserId: string | Types.ObjectId,
    invitedAt: Date = new Date(),
    tx?: TxContext
  ): Promise<IClient> {
    const session = this.getSession(tx);
    try {
      const updated = await this.model
        .findOneAndUpdate(
          { tenantId, _id: clientId },
          {
            $set: {
              "portalAccess.email": email.toLowerCase().trim(),
              "portalAccess.status": "invited",
              "portalAccess.invitedBy": new Types.ObjectId(actorUserId),
              "portalAccess.invitedAt": invitedAt,
              "portalAccess.lockout.failedCount": 0,
              "portalAccess.lockout.lockedUntil": null,
            },
            $unset: {
              "portalAccess.passwordHash": 1,
              "portalAccess.acceptedAt": 1,
            },
            $inc: { version: 1 },
          },
          { new: true, session: session ?? null }
        )
        .exec();

      if (!updated) {
        throw new AppError(ErrorCode.NOT_FOUND, "Client not found", 404);
      }
      return updated;
    } catch (err: any) {
      if (err.code === 11000) {
        throw new AppError(
          ErrorCode.DUPLICATE,
          `Client portal account with email '${email}' already exists`,
          409
        );
      }
      throw err;
    }
  }

  async reinvitePortal(
    tenantId: string,
    clientId: string | Types.ObjectId,
    actorUserId: string | Types.ObjectId,
    invitedAt: Date = new Date(),
    tx?: TxContext
  ): Promise<IClient> {
    const client = await this.findById(tenantId, clientId, false, tx);
    if (!client) {
      throw new AppError(ErrorCode.NOT_FOUND, "Client not found", 404);
    }

    const email = client.portalAccess?.email || client.email;
    if (!email) {
      throw new AppError(
        ErrorCode.VALIDATION_FAILED,
        "Cannot reinvite: client has no portal email registered",
        400
      );
    }

    return this.invitePortal(tenantId, clientId, email, actorUserId, invitedAt, tx);
  }

  async acceptInvite(
    tenantId: string,
    clientId: string | Types.ObjectId,
    passwordHash: string,
    invitedAtMs: number,
    tx?: TxContext
  ): Promise<IClient> {
    const session = this.getSession(tx);
    const expectedDate = new Date(invitedAtMs);

    const updated = await this.model
      .findOneAndUpdate(
        {
          tenantId,
          _id: clientId,
          "portalAccess.status": "invited",
          "portalAccess.invitedAt": expectedDate,
        },
        {
          $set: {
            "portalAccess.passwordHash": passwordHash,
            "portalAccess.status": "active",
            "portalAccess.acceptedAt": new Date(),
            "portalAccess.lockout.failedCount": 0,
            "portalAccess.lockout.lockedUntil": null,
          },
          $inc: { version: 1 },
        },
        { new: true, session: session ?? null }
      )
      .exec();

    if (!updated) {
      const existing = await this.model.findOne({ tenantId, _id: clientId }).lean();
      if (!existing) {
        throw new AppError(ErrorCode.NOT_FOUND, "Invited client does not exist", 404);
      }
      if (existing.portalAccess?.status === "locked") {
        throw new AppError(
          ErrorCode.ACCOUNT_LOCKED,
          "Client account is locked and cannot accept invitations",
          403
        );
      }
      if (existing.portalAccess?.status === "active") {
        throw new AppError(
          ErrorCode.INVITE_ALREADY_ACCEPTED,
          "Invitation has already been accepted or is no longer valid",
          400
        );
      }
      if (
        existing.portalAccess?.invitedAt &&
        existing.portalAccess.invitedAt.getTime() !== invitedAtMs
      ) {
        throw new AppError(
          ErrorCode.INVITE_EXPIRED,
          "Invitation token has been superseded by a newer invitation",
          400
        );
      }
      throw new AppError(
        ErrorCode.INVALID_TRANSITION,
        "Cannot accept invitation: invalid portal status",
        400
      );
    }
    return updated;
  }

  async lockPortal(
    tenantId: string,
    clientId: string | Types.ObjectId,
    tx?: TxContext
  ): Promise<IClient> {
    const session = this.getSession(tx);
    const updated = await this.model
      .findOneAndUpdate(
        { tenantId, _id: clientId },
        {
          $set: { "portalAccess.status": "locked" },
          $inc: { version: 1 },
        },
        { new: true, session: session ?? null }
      )
      .exec();

    if (!updated) {
      throw new AppError(ErrorCode.NOT_FOUND, "Client not found", 404);
    }
    return updated;
  }

  async unlockPortal(
    tenantId: string,
    clientId: string | Types.ObjectId,
    tx?: TxContext
  ): Promise<IClient> {
    const session = this.getSession(tx);
    const updated = await this.model
      .findOneAndUpdate(
        { tenantId, _id: clientId },
        {
          $set: {
            "portalAccess.status": "active",
            "portalAccess.lockout.failedCount": 0,
            "portalAccess.lockout.lockedUntil": null,
          },
          $inc: { version: 1 },
        },
        { new: true, session: session ?? null }
      )
      .exec();

    if (!updated) {
      throw new AppError(ErrorCode.NOT_FOUND, "Client not found", 404);
    }
    return updated;
  }

  async incrementFailedLogin(
    tenantId: string,
    clientId: string | Types.ObjectId,
    threshold = 5,
    durationMinutes = 15,
    tx?: TxContext
  ): Promise<{ lockedNow: boolean; failedCount: number }> {
    const session = this.getSession(tx);
    const client = await this.model
      .findOne({ tenantId, _id: clientId })
      .session(session ?? null)
      .exec();

    if (!client) {
      return { lockedNow: false, failedCount: 0 };
    }

    const currentCount = client.portalAccess?.lockout?.failedCount || 0;
    const newCount = currentCount + 1;
    const shouldLock = newCount >= threshold;

    const updates: Record<string, any> = {
      "portalAccess.lockout.failedCount": newCount,
    };

    if (shouldLock) {
      const lockedUntil = new Date(Date.now() + durationMinutes * 60 * 1000);
      updates["portalAccess.lockout.lockedUntil"] = lockedUntil;
      updates["portalAccess.status"] = "locked";
    }

    await this.model
      .updateOne({ tenantId, _id: clientId }, { $set: updates })
      .session(session ?? null)
      .exec();

    return { lockedNow: shouldLock, failedCount: newCount };
  }

  async resetLockout(
    tenantId: string,
    clientId: string | Types.ObjectId,
    tx?: TxContext
  ): Promise<void> {
    const session = this.getSession(tx);
    await this.model
      .updateOne(
        { tenantId, _id: clientId },
        {
          $set: {
            "portalAccess.lockout.failedCount": 0,
            "portalAccess.lockout.lockedUntil": null,
          },
        }
      )
      .session(session ?? null)
      .exec();
  }
}
