import { MachineRepository } from "../repositories/machine.repository.js";
import { SettingsRepository } from "../repositories/settings.repository.js";
import { IMachine } from "../models/catalog/machine.model.js";
import { PaginationQuery, PaginatedResult, paginate } from "../utils/pagination.js";
import { AuditService } from "./audit.service.js";
import { AppError } from "../errors/app-error.js";
import { ErrorCode } from "@loompilot/shared";

export interface SupervisorMachineDto {
  id: string;
  machineCode: string;
  machineName: string;
  processArea: string;
  capacityUnitsPerDay: number;
  currentStatus: string;
  machineType?: string;
}

export function toSupervisorMachineDto(m: any): SupervisorMachineDto {
  return {
    id: String(m._id || m.id),
    machineCode: m.machineCode,
    machineName: m.machineName,
    processArea: m.processArea,
    capacityUnitsPerDay: m.capacityUnitsPerDay,
    currentStatus: m.currentStatus,
    machineType: m.machineType,
  };
}

export class MachineService {
  constructor(
    private readonly machineRepo = new MachineRepository(),
    private readonly settingsRepo = new SettingsRepository(),
    private readonly auditService = new AuditService()
  ) {}

  private async validateProcessArea(tenantId: string, processArea: string): Promise<void> {
    const settings = await this.settingsRepo.getSettings(tenantId);
    if (!settings || !settings.processConfig || settings.processConfig.length === 0) {
      return;
    }
    const validAreas = new Set(settings.processConfig.map((p) => p.area.toLowerCase()));
    if (!validAreas.has(processArea.toLowerCase())) {
      throw new AppError(
        ErrorCode.VALIDATION_FAILED,
        `Machine process area '${processArea}' is invalid. Allowed areas: [${Array.from(validAreas).join(", ")}]`,
        400
      );
    }
  }

  async listMachines(
    tenantId: string,
    pagination: PaginationQuery,
    filterParams?: { processArea?: string; currentStatus?: string; search?: string },
    supervisorProcessAreas?: string[]
  ): Promise<PaginatedResult<any>> {
    const filter: Record<string, any> = {};

    if (supervisorProcessAreas !== undefined) {
      if (supervisorProcessAreas.length === 0) {
        return paginate([], 0, pagination.page, pagination.limit);
      }

      if (filterParams?.processArea) {
        if (!supervisorProcessAreas.includes(filterParams.processArea)) {
          return paginate([], 0, pagination.page, pagination.limit);
        }
        filter.processArea = filterParams.processArea;
      } else {
        filter.processArea = { $in: supervisorProcessAreas };
      }
    } else if (filterParams?.processArea) {
      filter.processArea = filterParams.processArea;
    }

    if (filterParams?.currentStatus) {
      filter.currentStatus = filterParams.currentStatus;
    }
    if (filterParams?.search) {
      filter.$or = [
        { machineCode: { $regex: filterParams.search.trim(), $options: "i" } },
        { machineName: { $regex: filterParams.search.trim(), $options: "i" } },
      ];
    }

    const result = await this.machineRepo.findPaginated(tenantId, filter, pagination);
    if (supervisorProcessAreas !== undefined) {
      return {
        data: result.data.map(toSupervisorMachineDto),
        meta: result.meta,
      };
    }
    return result;
  }

  async getMachineById(
    tenantId: string,
    id: string,
    supervisorProcessAreas?: string[]
  ): Promise<any> {
    const machine = await this.machineRepo.findById(tenantId, id);
    if (!machine) {
      throw new AppError(ErrorCode.NOT_FOUND, `Machine with id '${id}' not found`, 404);
    }

    if (supervisorProcessAreas !== undefined) {
      if (!supervisorProcessAreas.includes(machine.processArea)) {
        throw new AppError(
          ErrorCode.FORBIDDEN,
          "Access denied: Machine process area not in supervisor's assigned areas",
          403
        );
      }
      return toSupervisorMachineDto(machine);
    }

    return machine;
  }

  async createMachine(params: {
    tenantId: string;
    machineCode: string;
    machineName: string;
    processArea: string;
    capacityUnitsPerDay: number;
    machineType?: string;
    actor: { id: string; email?: string; ip?: string; requestId?: string };
  }): Promise<IMachine> {
    const { tenantId, actor, ...data } = params;
    await this.validateProcessArea(tenantId, data.processArea);

    const existing = await this.machineRepo.findOne(tenantId, { machineCode: data.machineCode.toUpperCase() });
    if (existing) {
      throw new AppError(ErrorCode.DUPLICATE, `Machine code '${data.machineCode}' already exists`, 409);
    }

    const created = await this.machineRepo.create(tenantId, {
      ...data,
      machineCode: data.machineCode.toUpperCase(),
      currentStatus: "available",
      version: 1,
    });

    await this.auditService.log({
      tenantId,
      actor: { id: actor.id, type: "user", email: actor.email },
      action: "MACHINE_CREATED",
      entity: { collection: "machines", id: String(created._id) },
      after: { machineCode: created.machineCode, processArea: created.processArea },
      ip: actor.ip,
      requestId: actor.requestId,
    });

    return created;
  }

  async updateMachine(params: {
    tenantId: string;
    id: string;
    updates: Partial<IMachine>;
    actor: { id: string; email?: string; ip?: string; requestId?: string };
  }): Promise<IMachine> {
    const { tenantId, id, updates, actor } = params;
    const before = await this.getMachineById(tenantId, id);

    if (updates.processArea) {
      await this.validateProcessArea(tenantId, updates.processArea);
    }

    const updated = await this.machineRepo.update(tenantId, id, updates);
    if (!updated) {
      throw new AppError(ErrorCode.NOT_FOUND, `Machine '${id}' not found`, 404);
    }

    await this.auditService.log({
      tenantId,
      actor: { id: actor.id, type: "user", email: actor.email },
      action: "MACHINE_UPDATED",
      entity: { collection: "machines", id },
      before,
      after: updated,
      ip: actor.ip,
      requestId: actor.requestId,
    });

    return updated;
  }

  async deleteMachine(params: {
    tenantId: string;
    id: string;
    actor: { id: string; email?: string; ip?: string; requestId?: string };
  }): Promise<void> {
    const { tenantId, id, actor } = params;
    const before = await this.getMachineById(tenantId, id);

    await this.machineRepo.update(tenantId, id, { currentStatus: "inactive" });

    await this.auditService.log({
      tenantId,
      actor: { id: actor.id, type: "user", email: actor.email },
      action: "MACHINE_DEACTIVATED",
      entity: { collection: "machines", id },
      before,
      after: { currentStatus: "inactive" },
      ip: actor.ip,
      requestId: actor.requestId,
    });
  }
}

