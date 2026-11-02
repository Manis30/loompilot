import { Request, Response, NextFunction } from "express";
import { SupervisorReportService } from "../services/supervisor-report.service.js";
import { OrderService } from "../services/order.service.js";
import { parsePaginationQuery } from "../utils/pagination.js";

export class SupervisorController {
  constructor(
    private readonly supervisorReportService = new SupervisorReportService(),
    private readonly orderService = new OrderService()
  ) {}

  listAssignedOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const pagination = parsePaginationQuery(req.query);
      const result = await this.orderService.listSupervisorOrders(
        actor.tenantId,
        actor.subjectId,
        pagination
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  submitReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const result = await this.supervisorReportService.submitReport(
        actor.tenantId,
        {
          id: actor.subjectId,
          type: "user",
          email: actor.email,
          role: actor.role,
        },
        req.body
      );
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  listReports = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const result = await this.supervisorReportService.listSupervisorReports(
        actor.tenantId,
        actor.subjectId,
        req.query
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  getReportById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const result = await this.supervisorReportService.getReportById(
        actor.tenantId,
        req.params.id as string,
        { id: actor.subjectId, role: actor.role }
      );
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  correctReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const result = await this.supervisorReportService.correctReport(
        actor.tenantId,
        req.params.id as string,
        {
          id: actor.subjectId,
          type: "user",
          email: actor.email,
          role: actor.role,
        },
        req.body
      );
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  listNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const result = await this.orderService.listSupervisorNotifications(
        actor.tenantId,
        actor.subjectId,
        {
          unreadOnly: req.query.unreadOnly === "true",
          kind: req.query.kind as string,
        },
        parsePaginationQuery(req.query)
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  markNotificationAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const result = await this.orderService.markSupervisorNotificationAsRead(
        actor.tenantId,
        req.params.id as string,
        actor.subjectId
      );
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };
}
