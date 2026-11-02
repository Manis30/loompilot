import { Model, ClientSession, RootFilterQuery } from "mongoose";
import { IBaseRepository, BaseEntity, QueryOptions } from "../interfaces/base-repository.interface.js";
import { TxContext } from "../interfaces/unit-of-work.interface.js";
import { PaginationQuery, PaginatedResult, paginate } from "../utils/pagination.js";
import { VersionConflictError } from "../errors/app-error.js";

export abstract class BaseRepository<T extends BaseEntity> implements IBaseRepository<T> {
  protected constructor(protected readonly model: Model<T>) {}

  protected getSession(tx?: TxContext): ClientSession | undefined {
    return tx?.session as ClientSession | undefined;
  }

  protected enforceTenant(tenantId: string, filter: Record<string, unknown> = {}): RootFilterQuery<T> {
    if (!tenantId || typeof tenantId !== "string" || tenantId.trim().length === 0) {
      throw new Error("Repository operation rejected: missing or invalid tenantId");
    }
    return { ...filter, tenantId } as RootFilterQuery<T>;
  }

  async findById(tenantId: string, id: string, tx?: TxContext): Promise<T | null> {
    const session = this.getSession(tx);
    const filter = this.enforceTenant(tenantId, { _id: id });
    return this.model.findOne(filter).session(session ?? null).lean<T>().exec();
  }

  async findOne(tenantId: string, filter: Record<string, unknown>, tx?: TxContext): Promise<T | null> {
    const session = this.getSession(tx);
    const scopedFilter = this.enforceTenant(tenantId, filter);
    return this.model.findOne(scopedFilter).session(session ?? null).lean<T>().exec();
  }

  async find(
    tenantId: string,
    filter: Record<string, unknown> = {},
    options?: QueryOptions,
    tx?: TxContext
  ): Promise<T[]> {
    const session = this.getSession(tx);
    const scopedFilter = this.enforceTenant(tenantId, filter);

    let query = this.model.find(scopedFilter).session(session ?? null).lean<T[]>();

    if (options?.sort) {
      query = query.sort(options.sort);
    }
    if (options?.skip !== undefined) {
      query = query.skip(options.skip);
    }
    if (options?.limit !== undefined) {
      query = query.limit(options.limit);
    }

    return query.exec();
  }

  async findPaginated(
    tenantId: string,
    filter: Record<string, unknown>,
    pagination: PaginationQuery,
    tx?: TxContext
  ): Promise<PaginatedResult<T>> {
    const session = this.getSession(tx);
    const scopedFilter = this.enforceTenant(tenantId, filter);
    const { page, limit, sortBy, sortOrder } = pagination;

    const skip = (page - 1) * limit;
    const sort: Record<string, 1 | -1> = sortBy
      ? { [sortBy]: sortOrder === "asc" ? 1 : -1 }
      : { createdAt: -1 };

    const [items, total] = await Promise.all([
      this.model
        .find(scopedFilter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .session(session ?? null)
        .lean<T[]>()
        .exec(),
      this.model
        .countDocuments(scopedFilter)
        .session(session ?? null)
        .exec(),
    ]);

    return paginate(items, total, page, limit);
  }

  async create(tenantId: string, data: Omit<T, "createdAt" | "updatedAt" | "tenantId"> & { tenantId?: string }, tx?: TxContext): Promise<T> {
    const session = this.getSession(tx);
    const docData = {
      ...data,
      tenantId,
      version: data.version ?? 1,
    };

    const [created] = await this.model.create([docData], { session });
    if (!created) {
      throw new Error("Failed to create document");
    }
    return created.toObject() as unknown as T;
  }

  async update(
    tenantId: string,
    id: string,
    update: Partial<T>,
    tx?: TxContext
  ): Promise<T | null> {
    const session = this.getSession(tx);
    const scopedFilter = this.enforceTenant(tenantId, { _id: id });

    return this.model
      .findOneAndUpdate(
        scopedFilter,
        {
          $set: update,
          $inc: { version: 1 },
        },
        { new: true, session: session ?? null }
      )
      .lean<T>()
      .exec();
  }

  async updateWithVersion(
    tenantId: string,
    id: string,
    currentVersion: number,
    update: Partial<T>,
    tx?: TxContext
  ): Promise<T | null> {
    const session = this.getSession(tx);
    const scopedFilter = this.enforceTenant(tenantId, {
      _id: id,
      version: currentVersion,
    });

    const updated = await this.model
      .findOneAndUpdate(
        scopedFilter,
        {
          $set: update,
          $inc: { version: 1 },
        },
        { new: true, session: session ?? null }
      )
      .lean<T>()
      .exec();

    if (!updated) {
      // Check whether doc exists with different version
      const exists = await this.model
        .findOne(this.enforceTenant(tenantId, { _id: id }))
        .session(session ?? null)
        .lean()
        .exec();

      if (exists) {
        throw new VersionConflictError();
      }
      return null;
    }

    return updated;
  }

  async delete(tenantId: string, id: string, tx?: TxContext): Promise<boolean> {
    const session = this.getSession(tx);
    const scopedFilter = this.enforceTenant(tenantId, { _id: id });
    const result = await this.model.deleteOne(scopedFilter).session(session ?? null).exec();
    return result.deletedCount === 1;
  }

  async count(tenantId: string, filter: Record<string, unknown> = {}, tx?: TxContext): Promise<number> {
    const session = this.getSession(tx);
    const scopedFilter = this.enforceTenant(tenantId, filter);
    return this.model.countDocuments(scopedFilter).session(session ?? null).exec();
  }
}

