import { UserRole } from "@loompilot/shared";
import { TxContext } from "./unit-of-work.js";

export interface User {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  refreshTokens: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface NewUser {
  tenantId: string;
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole;
  isActive?: boolean;
}

export interface IUserRepository {
  create(data: NewUser, tx?: TxContext): Promise<User>;
  findById(tenantId: string, id: string): Promise<User | null>;
  findByEmail(tenantId: string, email: string): Promise<User | null>;
  addRefreshToken(tenantId: string, userId: string, token: string, maxTokens?: number): Promise<void>;
  replaceRefreshToken(tenantId: string, userId: string, oldToken: string, newToken: string): Promise<boolean>;
  removeRefreshToken(tenantId: string, userId: string, token: string): Promise<void>;
  list(tenantId: string): Promise<User[]>;
  count(tenantId: string): Promise<number>;
}

