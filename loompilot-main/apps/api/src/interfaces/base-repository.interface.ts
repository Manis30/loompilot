import { TxContext } from "./unit-of-work.interface.js";
import { PaginationQuery, PaginatedResult } from "../utils/pagination.js";

export interface BaseEntity {
  id?: string;
  _id?: unknown;
  tenantId: string;
  createdAt?: Date;
  updatedAt?: Date;
  version?: number;
}

export interface QueryOptions {
  sort?: Record<string, 1 | -1>;
  limit?: number;
  skip?: number;
}

export interface IBaseRepository<T extends BaseEntity> {
  findById(tenantId: string, id: string, tx?: TxContext): Promise<T | null>;
  findOne(tenantId: string, filter: Record<string, unknown>, tx?: TxContext): Promise<T | null>;
  find(tenantId: string, filter?: Record<string, unknown>, options?: QueryOptions, tx?: TxContext): Promise<T[]>;
  findPaginated(tenantId: string, filter: Record<string, unknown>, pagination: PaginationQuery, tx?: TxContext): Promise<PaginatedResult<T>>;
  create(tenantId: string, data: Omit<T, "createdAt" | "updatedAt" | "tenantId"> & { tenantId?: string }, tx?: TxContext): Promise<T>;
  update(tenantId: string, id: string, update: Partial<T>, tx?: TxContext): Promise<T | null>;
  updateWithVersion(tenantId: string, id: string, currentVersion: number, update: Partial<T>, tx?: TxContext): Promise<T | null>;
  delete(tenantId: string, id: string, tx?: TxContext): Promise<boolean>;
  count(tenantId: string, filter?: Record<string, unknown>, tx?: TxContext): Promise<number>;
}

