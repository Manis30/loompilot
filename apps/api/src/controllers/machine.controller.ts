import { Request, Response } from "express";
import { MachineService } from "../services/machine.service.js";
import { parsePaginationQuery } from "../utils/pagination.js";

export class MachineController {
  constructor(private readonly machineService = new MachineService()) {}

  listMachines = async (req: Request, res: Response): Promise<void> => {
    const actor = req.actor!;
    const pagination = parsePaginationQuery(req.query as any);
    const filterParams = {
      processArea: req.query.processArea as string | undefined,
      currentStatus: req.query.currentStatus as string | undefined,
      search: req.query.search as string | undefined,
    };

    const supervisorAreas =
      actor.role === "supervisor" ? actor.processAreas || [] : undefined;

    const result = await this.machineService.listMachines(
      actor.tenantId,
      pagination,
      filterParams,
      supervisorAreas
    );
    res.json(result);
  };

  getMachineById = async (req: Request, res: Response): Promise<void> => {
    const actor = req.actor!;
    const supervisorAreas =
      actor.role === "supervisor" ? actor.processAreas || [] : undefined;

    const machine = await this.machineService.getMachineById(
      actor.tenantId,
      req.params.id as string,
      supervisorAreas
    );
    res.json({ data: machine });
  };

  createMachine = async (req: Request, res: Response): Promise<void> => {
    const actor = req.actor!;
    const created = await this.machineService.createMachine({
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

  updateMachine = async (req: Request, res: Response): Promise<void> => {
    const actor = req.actor!;
    const updated = await this.machineService.updateMachine({
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

  deleteMachine = async (req: Request, res: Response): Promise<void> => {
    const actor = req.actor!;
    await this.machineService.deleteMachine({
      tenantId: actor.tenantId,
      id: req.params.id as string,
      actor: {
        id: actor.subjectId,
        ip: req.ip,
        requestId: actor.requestId,
      },
    });
    res.json({ success: true, message: "Machine deleted successfully" });
  };
}
