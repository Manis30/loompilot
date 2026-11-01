import { Request, Response, NextFunction } from "express";
import { SupervisorReportService } from "../services/supervisor-report.service.js";

export class SupervisorAdminController {
  constructor(private readonly supervisorReportService = new SupervisorReportService()) {}

  listAllSupervisorReports = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const actor = req.actor!;
      const result = await this.supervisorReportService.listAdminSupervisorReports(
        actor.tenantId,
        req.query
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  };
}

