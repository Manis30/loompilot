import { Types } from "mongoose";
import { MaintenanceTicketRepository } from "../repositories/maintenance-ticket.repository.js";
import { MachineRepository } from "../repositories/machine.repository.js";
import { AuditService } from "./audit.service.js";
import { AppError } from "../errors/app-error.js";
import { ErrorCode, assertTransition } from "@loompilot/shared";
import { PaginationQuery, PaginatedResult } from "../utils/pagination.js";

export class MaintenanceTicketService {
  constructor(
    private readonly ticketRepo = new MaintenanceTicketRepository(),
    private readonly machineRepo = new MachineRepository(),
    private readonly auditService = new AuditService()
  ) {}

  async createTicket(
    tenantId: string,
    actor: { id: string; type?: string; email?: string; role?: string },
    data: {
      machineId: string;
      issue: string;
      notes?: string;
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

    const ticket = await this.ticketRepo.create(tenantId, {
      machineId: new Types.ObjectId(resolvedMachineId),
      issue: data.issue,
      notes: data.notes,
      status: "open",
      openedBy: actor.id && Types.ObjectId.isValid(actor.id) ? new Types.ObjectId(actor.id) : undefined,
      version: 1,
    } as any);

    // Update machine status to breakdown
    await this.machineRepo.updateMachineStatus(tenantId, resolvedMachineId, "breakdown");

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
    const currentTicket = await this.ticketRepo.findById(tenantId, ticketId);
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
        // Update machine status to maint
        if (currentTicket.machineId) {
          await this.machineRepo.updateMachineStatus(tenantId, String(currentTicket.machineId), "maint");
        }
      } else if (data.status === "resolved") {
        updates.resolvedAt = new Date();
        // Machine is back to available
        if (currentTicket.machineId) {
          await this.machineRepo.updateMachineStatus(tenantId, String(currentTicket.machineId), "available");
        }
      }
    }

    const updated = await this.ticketRepo.updateTicket(tenantId, ticketId, updates);
    if (!updated) {
      throw new AppError(ErrorCode.NOT_FOUND, "Maintenance ticket not found", 404);
    }

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
