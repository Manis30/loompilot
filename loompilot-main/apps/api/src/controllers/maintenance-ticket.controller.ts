import { Request, Response, NextFunction } from "express";
import { MaintenanceTicketService } from "../services/maintenance-ticket.service.js";
import { parsePaginationQuery } from "../utils/pagination.js";

export class MaintenanceTicketController {
  constructor(private readonly ticketService = new MaintenanceTicketService()) {}

  createTicket = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const result = await this.ticketService.createTicket(
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

  listTickets = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const filter = {
        machineId: req.query.machineId as string | undefined,
        status: req.query.status as string | undefined,
      };
      const pagination = parsePaginationQuery(req.query);
      const result = await this.ticketService.listTickets(actor.tenantId, filter, pagination);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  getTicketById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const result = await this.ticketService.getTicketById(actor.tenantId, req.params.id as string);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  updateTicket = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const result = await this.ticketService.updateTicket(
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
}
