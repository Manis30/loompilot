import {
  IRefreshTokenRepository,
  RefreshTokenRecord,
  NewRefreshToken,
} from "../interfaces/refresh-token.repository.js";

export class InMemoryRefreshTokenRepository implements IRefreshTokenRepository {
  private tokens: RefreshTokenRecord[] = [];

  async create(data: NewRefreshToken): Promise<RefreshTokenRecord> {
    const record: RefreshTokenRecord = {
      id: `rt_${Date.now()}_${Math.random()}`,
      tenantId: data.tenantId,
      userId: data.userId,
      tokenHash: data.tokenHash,
      familyId: data.familyId,
      revoked: false,
      ip: data.ip,
      userAgent: data.userAgent,
      expiresAt: data.expiresAt,
      createdAt: new Date(),
    };
    this.tokens.push(record);
    return record;
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    return this.tokens.find((t) => t.tokenHash === tokenHash) || null;
  }

  async revoke(id: string): Promise<void> {
    const t = this.tokens.find((x) => x.id === id);
    if (t) t.revoked = true;
  }

  async revokeFamily(familyId: string): Promise<void> {
    for (const t of this.tokens.filter((x) => x.familyId === familyId)) {
      t.revoked = true;
    }
  }

  async revokeAllForUser(tenantId: string, userId: string): Promise<void> {
    for (const t of this.tokens.filter((x) => x.tenantId === tenantId && x.userId === userId)) {
      t.revoked = true;
    }
  }
}

