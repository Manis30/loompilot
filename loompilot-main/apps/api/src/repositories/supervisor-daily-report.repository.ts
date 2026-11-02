import { Types } from "mongoose";
import { BaseRepository } from "./base.repository.js";
import {
  ISupervisorDailyReport,
  SupervisorDailyReportModel,
  ISupervisorCorrection,
} from "../models/production/supervisor-daily-report.model.js";
import { TxContext } from "../interfaces/unit-of-work.interface.js";
import { PaginationQuery, PaginatedResult } from "../utils/pagination.js";

export class SupervisorDailyReportRepository extends BaseRepository<ISupervisorDailyReport> {
  constructor() {
    super(SupervisorDailyReportModel);
  }

  async findBySupervisorAndDate(
    tenantId: string,
    supervisorId: string | Types.ObjectId,
    reportDate: string,
    tx?: TxContext
  ): Promise<ISupervisorDailyReport | null> {
    const session = this.getSession(tx);
    return this.model
      .findOne({
        tenantId,
        supervisorId: typeof supervisorId === "string" ? new Types.ObjectId(supervisorId) : supervisorId,
        reportDate,
      })
      .session(session ?? null)
      .lean<ISupervisorDailyReport>()
      .exec();
  }

  async findByClientGeneratedId(
    tenantId: string,
    clientGeneratedId: string,
    tx?: TxContext
  ): Promise<ISupervisorDailyReport | null> {
    const session = this.getSession(tx);
    return this.model
      .findOne({ tenantId, clientGeneratedId })
      .session(session ?? null)
      .lean<ISupervisorDailyReport>()
      .exec();
  }

  async findPaginatedReports(
    tenantId: string,
    filter: Record<string, any> = {},
    pagination: Partial<PaginationQuery> = {}
  ): Promise<PaginatedResult<ISupervisorDailyReport>> {
    const queryFilter: Record<string, any> = { tenantId };

    if (filter.supervisorId) {
      queryFilter.supervisorId =
        typeof filter.supervisorId === "string" ? new Types.ObjectId(filter.supervisorId) : filter.supervisorId;
    }
    if (filter.reportDate) {
      queryFilter.reportDate = filter.reportDate;
    }
    if (filter.status) {
      queryFilter.status = filter.status;
    }
    if (filter.isLate !== undefined) {
      queryFilter.isLate = filter.isLate;
    }
    if (filter.fromDate || filter.toDate) {
      const dateRange: Record<string, any> = {};
      if (filter.fromDate) dateRange.$gte = filter.fromDate;
      if (filter.toDate) dateRange.$lte = filter.toDate;
      queryFilter.reportDate = dateRange;
    }

    const page = Math.max(1, pagination.page || 1);
    const limit = Math.min(100, Math.max(1, pagination.limit || 20));
    const skip = (page - 1) * limit;

    const [items, totalItems] = await Promise.all([
      this.model
        .find(queryFilter)
        .sort({ reportDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean<ISupervisorDailyReport[]>()
        .exec(),
      this.model.countDocuments(queryFilter).exec(),
    ]);

    const totalPages = Math.ceil(totalItems / limit) || 1;

    return {
      data: items,
      meta: {
        page,
        limit,
        total: totalItems,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async addCorrection(
    tenantId: string,
    reportId: string | Types.ObjectId,
    correction: ISupervisorCorrection,
    updates: Partial<ISupervisorDailyReport>,
    tx?: TxContext
  ): Promise<ISupervisorDailyReport | null> {
    const session = this.getSession(tx);
    const updateOps: Record<string, any> = {
      $push: { corrections: correction },
      $set: { status: "corrected", ...updates },
      $inc: { version: 1 },
    };

    return this.model
      .findOneAndUpdate({ tenantId, _id: reportId }, updateOps, {
        new: true,
        session: session ?? null,
      })
      .lean<ISupervisorDailyReport>()
      .exec();
  }
}
