import { Request, Response } from "express";
import { IAuditLogRepository } from "../interfaces/audit-log.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { parseListQuery, buildPaginatedEnvelope } from "../utils/pagination.js";

export class AuditController {
  constructor(private readonly repo: IAuditLogRepository) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId;
    const pagination = parseListQuery(req.query);

    const filters = {
      entityType: req.query.entityType as string | undefined,
      entityId: req.query.entityId as string | undefined,
      actorId: req.query.actorId as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      page: pagination.page,
      limit: pagination.limit,
    };

    const { data, total } = await this.repo.query(tenantId, filters);

    res.json(
      buildPaginatedEnvelope(
        data,
        {
          page: pagination.page,
          limit: pagination.limit,
          total,
        },
        req.requestId
      )
    );
  });
}

