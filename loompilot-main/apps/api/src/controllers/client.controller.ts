import { Request, Response, NextFunction } from "express";
import { ClientService } from "../services/client.service.js";
import { parsePaginationQuery } from "../utils/pagination.js";

export class ClientController {
  constructor(private readonly clientService = new ClientService()) {}

  listClients = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const pagination = parsePaginationQuery(req.query as any);
      const search = req.query.search as string | undefined;
      const status = req.query.status as "active" | "inactive" | undefined;
      const customerType = req.query.customerType as string | undefined;
      const city = req.query.city as string | undefined;
      const country = req.query.country as string | undefined;
      const portalStatus = req.query.portalStatus as "invited" | "active" | "locked" | undefined;

      const result = await this.clientService.listClients(actor.tenantId, pagination, {
        search,
        status,
        customerType,
        city,
        country,
        portalStatus,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  getClientById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const client = await this.clientService.getClientById(actor.tenantId, req.params.id as string);
      res.json({ data: client });
    } catch (err) {
      next(err);
    }
  };

  createClient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const created = await this.clientService.createClient({
        tenantId: actor.tenantId,
        clientName: req.body.clientName,
        contactPerson: req.body.contactPerson,
        email: req.body.email,
        phone: req.body.phone,
        city: req.body.city,
        address: req.body.address,
        customerType: req.body.customerType,
        paymentTermsDays: req.body.paymentTermsDays,
        country: req.body.country,
        status: req.body.status,
        actor: {
          id: actor.subjectId,
          email: actor.email,
          ip: req.ip,
          requestId: actor.requestId,
        },
      });
      res.status(201).json({ data: created });
    } catch (err) {
      next(err);
    }
  };

  updateClient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const updated = await this.clientService.updateClient({
        tenantId: actor.tenantId,
        id: req.params.id as string,
        updates: {
          clientName: req.body.clientName,
          contactPerson: req.body.contactPerson,
          email: req.body.email,
          phone: req.body.phone,
          city: req.body.city,
          address: req.body.address,
          customerType: req.body.customerType,
          paymentTermsDays: req.body.paymentTermsDays,
          country: req.body.country,
          status: req.body.status,
        },
        actor: {
          id: actor.subjectId,
          email: actor.email,
          ip: req.ip,
          requestId: actor.requestId,
        },
      });
      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  };

  deleteClient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      await this.clientService.deactivateClient({
        tenantId: actor.tenantId,
        id: req.params.id as string,
        actor: {
          id: actor.subjectId,
          email: actor.email,
          ip: req.ip,
          requestId: actor.requestId,
        },
      });
      res.json({ success: true, message: "Client deactivated successfully" });
    } catch (err) {
      next(err);
    }
  };
}
