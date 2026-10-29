import {
  IRefreshTokenRepository,
  RefreshTokenRecord,
  NewRefreshToken,
} from "../interfaces/refresh-token.repository.js";
import { RefreshTokenModel } from "../models/refresh-token.model.js";

export class MongoRefreshTokenRepository implements IRefreshTokenRepository {
  private toEntity(doc: any): RefreshTokenRecord {
    return {
      id: doc._id.toString(),
      tenantId: doc.tenantId,
      userId: doc.userId,
      tokenHash: doc.tokenHash,
      familyId: doc.familyId,
      revoked: doc.revoked,
      ip: doc.ip,
      userAgent: doc.userAgent,
      expiresAt: doc.expiresAt,
      createdAt: doc.createdAt,
    };
  }

  async create(data: NewRefreshToken): Promise<RefreshTokenRecord> {
    const doc = await RefreshTokenModel.create({
      tenantId: data.tenantId,
      userId: data.userId,
      tokenHash: data.tokenHash,
      familyId: data.familyId,
      revoked: false,
      ip: data.ip,
      userAgent: data.userAgent,
      expiresAt: data.expiresAt,
    });
    return this.toEntity(doc);
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const doc = await RefreshTokenModel.findOne({ tokenHash }).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async revoke(id: string): Promise<void> {
    await RefreshTokenModel.updateOne({ _id: id }, { $set: { revoked: true } });
  }

  async revokeFamily(familyId: string): Promise<void> {
    await RefreshTokenModel.updateMany({ familyId }, { $set: { revoked: true } });
  }

  async revokeAllForUser(tenantId: string, userId: string): Promise<void> {
    await RefreshTokenModel.updateMany(
      { tenantId, userId, revoked: false },
      { $set: { revoked: true } }
    );
  }
}

