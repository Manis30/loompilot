import { Types } from "mongoose";
import { BaseRepository } from "./base.repository.js";
import {
  IRefreshToken,
  RefreshTokenModel,
} from "../models/platform/refresh-token.model.js";

export class RefreshTokenRepository extends BaseRepository<IRefreshToken> {
  constructor() {
    super(RefreshTokenModel);
  }

  async findByTokenHash(tokenHash: string): Promise<IRefreshToken | null> {
    return this.model.findOne({ tokenHash });
  }

  async createToken(data: {
    tenantId: string;
    realm: "user" | "client";
    subjectId: Types.ObjectId | string;
    familyId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<IRefreshToken> {
    const subjectId =
      typeof data.subjectId === "string"
        ? new Types.ObjectId(data.subjectId)
        : data.subjectId;
    return this.model.create({ ...data, subjectId });
  }

  /**
   * Atomically marks old token as revoked and rotated, and creates the replacement token.
   */
  async rotateToken(
    oldTokenHash: string,
    newTokenData: {
      tenantId: string;
      realm: "user" | "client";
      subjectId: Types.ObjectId | string;
      familyId: string;
      tokenHash: string;
      expiresAt: Date;
    }
  ): Promise<IRefreshToken> {
    await this.model.updateOne(
      { tokenHash: oldTokenHash },
      {
        $set: {
          revokedAt: new Date(),
          replacedByTokenHash: newTokenData.tokenHash,
        },
      }
    );

    const subjectId =
      typeof newTokenData.subjectId === "string"
        ? new Types.ObjectId(newTokenData.subjectId)
        : newTokenData.subjectId;

    return this.model.create({ ...newTokenData, subjectId });
  }

  /**
   * Revokes all tokens belonging to a family when reuse is detected.
   */
  async revokeFamily(familyId: string): Promise<number> {
    const result = await this.model.updateMany(
      { familyId, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } }
    );
    return result.modifiedCount;
  }

  /**
   * Revokes all tokens for a subject (e.g. on lockout, password change, or logout-all).
   */
  async revokeAllForSubject(
    tenantId: string,
    realm: "user" | "client",
    subjectId: Types.ObjectId | string
  ): Promise<number> {
    const objId =
      typeof subjectId === "string" ? new Types.ObjectId(subjectId) : subjectId;
    const result = await this.model.updateMany(
      { tenantId, realm, subjectId: objId, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } }
    );
    return result.modifiedCount;
  }
}
