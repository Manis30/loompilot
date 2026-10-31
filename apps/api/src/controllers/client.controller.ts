import { Request, Response } from "express";
import { ClientService } from "../services/client.service.js";
import { parsePaginationQuery } from "../utils/pagination.js";

export class ClientController {
  constructor(private readonly clientService = new ClientService()) {}

  listClients = async (req: Request, res: Response): Promise<void> => {
    const actor = req.actor!;
    const pagination = parsePaginationQuery(req.query as any);
    const search = req.query.search as string | undefined;

    const result = await this.clientService.listClients(actor.tenantId, pagination, search);
    res.json(result);
  };

  getClientById = async (req: Request, res: Response): Promise<void> => {
    const actor = req.actor!;
    const client = await this.clientService.getClientById(actor.tenantId, req.params.id as string);
    res.json({ data: client });
  };

  createClient = async (req: Request, res: Response): Promise<void> => {
    const actor = req.actor!;
    const created = await this.clientService.createClient({
      tenantId: actor.tenantId,
      ...req.body,
      actor: {
        id: actor.subjectId,
        ip: req.ip,
        requestId: actor.requestId,
      },
    });
    res.status(201).json({ data: created });
  };

  updateClient = async (req: Request, res: Response): Promise<void> => {
    const actor = req.actor!;
    const updated = await this.clientService.updateClient({
      tenantId: actor.tenantId,
      id: req.params.id as string,
      updates: req.body,
      actor: {
        id: actor.subjectId,
        ip: req.ip,
        requestId: actor.requestId,
      },
    });
    res.json({ data: updated });
  };

  deleteClient = async (req: Request, res: Response): Promise<void> => {
    const actor = req.actor!;
    await this.clientService.deactivateClient({
      tenantId: actor.tenantId,
      id: req.params.id as string,
      actor: {
        id: actor.subjectId,
        ip: req.ip,
        requestId: actor.requestId,
      },
    });
    res.json({ success: true, message: "Client deactivated successfully" });
  };
}
