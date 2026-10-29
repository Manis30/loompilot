export interface RefreshTokenRecord {
  id: string;
  tenantId: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  revoked: boolean;
  ip?: string;
  userAgent?: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface NewRefreshToken {
  tenantId: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  ip?: string;
  userAgent?: string;
  expiresAt: Date;
}

export interface IRefreshTokenRepository {
  create(data: NewRefreshToken): Promise<RefreshTokenRecord>;
  findByTokenHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  revoke(id: string): Promise<void>;
  revokeFamily(familyId: string): Promise<void>;
  revokeAllForUser(tenantId: string, userId: string): Promise<void>;
}

