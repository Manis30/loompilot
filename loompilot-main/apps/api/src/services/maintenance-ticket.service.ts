import { Types } from "mongoose";
import { MaintenanceTicketRepository } from "../repositories/maintenance-ticket.repository.js";
import { MachineRepository } from "../repositories/machine.repository.js";
import { AuditService } from "./audit.service.js";
import { AppError } from "../errors/app-error.js";
import { ErrorCode, assertTransition } from "@loompilot/shared";
import { PaginationQuery, PaginatedResult } from "../utils/pagination.js";
import { IUnitOfWork } from "../interfaces/unit-of-work.interface.js";
import { MongoUnitOfWork } from "../repositories/unit-of-work.js";

export class MaintenanceTicketService {
  constructor(
    private readonly ticketRepo = new MaintenanceTicketRepository(),
    private readonly machineRepo = new MachineRepository(),
    private readonly auditService = new AuditService(),
    private readonly unitOfWork: IUnitOfWork = new MongoUnitOfWork()
  ) {}

  async createTicket(
    tenantId: string,
    actor: { id: string; type?: string; email?: string; role?: string },
    data: {
      machineId: string;
      issue: string;
      notes?: string;
      sourceReportId?: string;
    }
  ): Promise<any> {
    let machine = null;
    if (Types.ObjectId.isValid(data.machineId)) {
      machine = await this.machineRepo.findById(tenantId, data.machineId);
    }
    if (!machine) {
      machine = await this.machineRepo.findOne(tenantId, {
        machineCode: data.machineId.toUpperCase(),
      });
    }
    if (!machine) {
      throw new AppError(ErrorCode.NOT_FOUND, "Machine not found", 404);
    }

    const resolvedMachineId = String(machine._id);

    const ticket = await this.unitOfWork.withTransaction(async (tx) => {
      // Concurrency lock: serialize against concurrent ticket resolution or status updates
      const lockedMachine = await this.machineRepo.lockMachine(tenantId, resolvedMachineId, tx);
      if (!lockedMachine) {
        throw new AppError(ErrorCode.NOT_FOUND, "Machine not found", 404);
      }

      const created = await this.ticketRepo.create(
        tenantId,
        {
          machineId: new Types.ObjectId(resolvedMachineId),
          sourceReportId:
            data.sourceReportId && Types.ObjectId.isValid(data.sourceReportId)
              ? new Types.ObjectId(data.sourceReportId)
              : undefined,
          issue: data.issue,
          notes: data.notes,
          status: "open",
          openedBy: actor.id && Types.ObjectId.isValid(actor.id) ? new Types.ObjectId(actor.id) : undefined,
          version: 1,
        } as any,
        tx
      );

      // Inactive safeguard: preserve inactive status if machine is decommissioned
      if (lockedMachine.currentStatus !== "inactive") {
        if (lockedMachine.currentStatus !== "breakdown") {
          await this.machineRepo.updateMachineStatus(tenantId, resolvedMachineId, "breakdown", tx);
        }
      }

      return created;
    });

    await this.auditService.log({
      tenantId,
      actor: { id: actor.id, type: "user", email: actor.email },
      action: "MAINTENANCE_TICKET_CREATED",
      entity: { collection: "maintenanceTickets", id: String(ticket._id) },
      after: { machineId: resolvedMachineId, issue: data.issue, status: "open" },
    });

    return ticket;
  }

  async listTickets(
    tenantId: string,
    filter: { machineId?: string; status?: string } = {},
    pagination: Partial<PaginationQuery> = {}
  ): Promise<PaginatedResult<any>> {
    return this.ticketRepo.findPaginatedTickets(tenantId, filter, pagination);
  }

  async getTicketById(tenantId: string, ticketId: string): Promise<any> {
    const ticket = await this.ticketRepo.findById(tenantId, ticketId);
    if (!ticket) {
      throw new AppError(ErrorCode.NOT_FOUND, "Maintenance ticket not found", 404);
    }
    return ticket;
  }

  async updateTicket(
    tenantId: string,
    ticketId: string,
    actor: { id: string; type?: string; email?: string; role?: string },
    data: {
      status?: "open" | "assigned" | "resolved";
      technicianName?: string;
      technicianContact?: string;
      notes?: string;
    }
  ): Promise<any> {
    const { updated, currentTicket, updates } = await this.unitOfWork.withTransaction(async (tx) => {
      const currentTicket = await this.ticketRepo.findById(tenantId, ticketId, tx);
      if (!currentTicket) {
        throw new AppError(ErrorCode.NOT_FOUND, "Maintenance ticket not found", 404);
      }

      const updates: Record<string, any> = {};

      if (data.notes !== undefined) {
        updates.notes = data.notes;
      }

      if (data.technicianName !== undefined) {
        updates.technicianName = data.technicianName;
      }

      if (data.technicianContact !== undefined) {
        updates.technicianContact = data.technicianContact;
      }

      if (data.status && data.status !== currentTicket.status) {
        // Validate transition via shared state machine safeguards
        assertTransition("ticket", currentTicket.status, data.status, {
          technicianName: data.technicianName || currentTicket.technicianName,
          technicianContact: data.technicianContact || currentTicket.technicianContact,
        });

        updates.status = data.status;

        if (data.status === "assigned") {
          updates.assignedAt = new Date();
        } else if (data.status === "resolved") {
          updates.resolvedAt = new Date();
        }
      }

      const updated = await this.ticketRepo.updateTicket(tenantId, ticketId, updates, tx);
      if (!updated) {
        throw new AppError(ErrorCode.NOT_FOUND, "Maintenance ticket not found", 404);
      }

      // Safely recalculate machine availability if ticket status changed
      if (data.status && data.status !== currentTicket.status && currentTicket.machineId) {
        const machineIdStr = String(currentTicket.machineId);

        // Lock the machine document inside the transaction to serialize concurrent
        // ticket status resolutions for the same machine and trigger WriteConflict on race.
        const machine = await this.machineRepo.lockMachine(tenantId, machineIdStr, tx);

        if (machine && machine.currentStatus !== "inactive") {
          const remainingUnresolved = await this.ticketRepo.findUnresolvedTicketsForMachine(
            tenantId,
            currentTicket.machineId,
            ticketId,
            tx
          );

          if (data.status === "resolved") {
            if (remainingUnresolved.length === 0) {
              // No other unresolved tickets: machine is safe to return to available
              await this.machineRepo.updateMachineStatus(tenantId, machineIdStr, "available", tx);
            } else {
              // Other unresolved tickets exist:
              // If any unresolved ticket is open, machine remains in breakdown; otherwise maint
              const hasOpen = remainingUnresolved.some((t) => t.status === "open");
              const targetStatus = hasOpen ? "breakdown" : "maint";
              if (machine.currentStatus !== targetStatus) {
                await this.machineRepo.updateMachineStatus(tenantId, machineIdStr, targetStatus, tx);
              }
            }
          } else if (data.status === "assigned") {
            const hasOpen = remainingUnresolved.some((t) => t.status === "open");
            const targetStatus = hasOpen ? "breakdown" : "maint";
            if (machine.currentStatus !== targetStatus) {
              await this.machineRepo.updateMachineStatus(tenantId, machineIdStr, targetStatus, tx);
            }
          }
        }
      }

      return { updated, currentTicket, updates };
    });

    await this.auditService.log({
      tenantId,
      actor: { id: actor.id, type: "user", email: actor.email },
      action: "MAINTENANCE_TICKET_UPDATED",
      entity: { collection: "maintenanceTickets", id: ticketId },
      before: { status: currentTicket.status },
      after: updates,
    });

    return updated;
  }
}
