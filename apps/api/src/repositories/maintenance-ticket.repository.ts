import { Types } from "mongoose";
import { BaseRepository } from "./base.repository.js";
import {
  IMaintenanceTicket,
  MaintenanceTicketModel,
} from "../models/production/maintenance-ticket.model.js";
import { TxContext } from "../interfaces/unit-of-work.interface.js";
import { PaginationQuery, PaginatedResult } from "../utils/pagination.js";

export class MaintenanceTicketRepository extends BaseRepository<IMaintenanceTicket> {
  constructor() {
    super(MaintenanceTicketModel);
  }

  async findPaginatedTickets(
    tenantId: string,
    filter: Record<string, any> = {},
    pagination: Partial<PaginationQuery> = {}
  ): Promise<PaginatedResult<IMaintenanceTicket>> {
    const queryFilter: Record<string, any> = { tenantId };

    if (filter.machineId) {
      queryFilter.machineId =
        typeof filter.machineId === "string" ? new Types.ObjectId(filter.machineId) : filter.machineId;
    }
    if (filter.status) {
      queryFilter.status = filter.status;
    }

    const page = Math.max(1, pagination.page || 1);
    const limit = Math.min(100, Math.max(1, pagination.limit || 20));
    const skip = (page - 1) * limit;

    const [items, totalItems] = await Promise.all([
      this.model
        .find(queryFilter)
        .populate("machineId", "machineCode machineName processArea currentStatus")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean<IMaintenanceTicket[]>()
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

  async updateTicket(
    tenantId: string,
    ticketId: string | Types.ObjectId,
    updates: Partial<IMaintenanceTicket>,
    tx?: TxContext
  ): Promise<IMaintenanceTicket | null> {
    const session = this.getSession(tx);
    return this.model
      .findOneAndUpdate(
        { tenantId, _id: ticketId },
        { $set: updates, $inc: { version: 1 } },
        { new: true, session: session ?? null }
      )
      .lean<IMaintenanceTicket>()
      .exec();
  }

  async findUnresolvedTicketsForMachine(
    tenantId: string,
    machineId: string | Types.ObjectId,
    excludeTicketId?: string | Types.ObjectId,
    tx?: TxContext
  ): Promise<IMaintenanceTicket[]> {
    const session = this.getSession(tx);
    const filter: Record<string, any> = {
      tenantId,
      machineId: typeof machineId === "string" ? new Types.ObjectId(machineId) : machineId,
      status: { $in: ["open", "assigned"] },
    };
    if (excludeTicketId) {
      filter._id = { $ne: typeof excludeTicketId === "string" ? new Types.ObjectId(excludeTicketId) : excludeTicketId };
    }
    return this.model
      .find(filter)
      .session(session ?? null)
      .lean<IMaintenanceTicket[]>()
      .exec();
  }
}
