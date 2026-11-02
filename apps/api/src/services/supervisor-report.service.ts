import { Types } from "mongoose";
import { SupervisorDailyReportRepository } from "../repositories/supervisor-daily-report.repository.js";
import { OrdersRepository } from "../repositories/orders.repository.js";
import { MachineRepository } from "../repositories/machine.repository.js";
import { MaintenanceTicketRepository } from "../repositories/maintenance-ticket.repository.js";
import { MaintenanceTicketService } from "./maintenance-ticket.service.js";
import { AuditService } from "./audit.service.js";
import { AppError } from "../errors/app-error.js";
import { ErrorCode, OrderStatus } from "@loompilot/shared";
import { PaginationQuery, PaginatedResult } from "../utils/pagination.js";
import { IUnitOfWork } from "../interfaces/unit-of-work.interface.js";
import { MongoUnitOfWork } from "../repositories/unit-of-work.js";

export class SupervisorReportService {
  constructor(
    private readonly reportRepo = new SupervisorDailyReportRepository(),
    private readonly ordersRepo = new OrdersRepository(),
    private readonly machineRepo = new MachineRepository(),
    private readonly ticketRepo = new MaintenanceTicketRepository(),
    private readonly auditService = new AuditService(),
    private readonly ticketService = new MaintenanceTicketService(
      ticketRepo,
      machineRepo,
      auditService
    ),
    private readonly unitOfWork: IUnitOfWork = new MongoUnitOfWork()
  ) {}

  async submitReport(
    tenantId: string,
    actor: { id: string; type?: string; email?: string; role?: string },
    data: {
      reportDate: string;
      processAreas: string[];
      employeesPresentTotal: number;
      workforce?: Array<{ area: string; count: number }>;
      resources?: { machinesAvail: number; machinesDown?: number };
      stockCounts?: Array<{ materialId: string; qty: number }>;
      outputs?: Array<{ orderId: string; stage: string; produced: number; defective?: number }>;
      machines?: Array<{ machineId: string; status: "available" | "maint" | "breakdown"; hours: number; remarks?: string }>;
      issues?: Array<{ type: "machine" | "shortage" | "delay" | "quality" | "other"; notes: string; machineId?: string }>;
      clientGeneratedId?: string;
    }
  ): Promise<any> {
    // 1. Idempotency check via clientGeneratedId
    if (data.clientGeneratedId) {
      const existing = await this.reportRepo.findByClientGeneratedId(tenantId, data.clientGeneratedId);
      if (existing) {
        return existing;
      }
    }

    // 2. Duplicate submission prevention: 1 report per supervisor per date
    const duplicate = await this.reportRepo.findBySupervisorAndDate(tenantId, actor.id, data.reportDate);
    if (duplicate) {
      throw new AppError(
        ErrorCode.DUPLICATE,
        "A daily report has already been submitted for this date. Submit a correction instead.",
        409
      );
    }

    // 3. Workforce validation: sum must match employeesPresentTotal if provided
    if (data.workforce && data.workforce.length > 0) {
      const sum = data.workforce.reduce((acc, w) => acc + (w.count || 0), 0);
      if (sum !== data.employeesPresentTotal) {
        throw new AppError(
          ErrorCode.VALIDATION_FAILED,
          `Workforce count sum (${sum}) must equal employeesPresentTotal (${data.employeesPresentTotal})`,
          400
        );
      }
    }

    // 4. Cutoff check: 19:00 local cutoff time
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    let isLate = false;
    if (data.reportDate < todayStr) {
      isLate = true;
    } else if (data.reportDate === todayStr) {
      const currentHourMin = now.toISOString().slice(11, 16);
      if (currentHourMin > "19:00") {
        isLate = true;
      }
    }

    // 5. Create report document
    const reportData = {
      tenantId,
      supervisorId: actor.id as any,
      reportDate: data.reportDate,
      processAreas: data.processAreas,
      employeesPresentTotal: data.employeesPresentTotal,
      workforce: data.workforce,
      resources: data.resources,
      stockCounts: data.stockCounts?.map((s) => ({ materialId: s.materialId as any, qty: s.qty })),
      outputs: data.outputs?.map((o) => ({
        orderId: o.orderId as any,
        stage: o.stage,
        produced: o.produced,
        defective: o.defective || 0,
      })),
      machines: data.machines?.map((m) => ({
        machineId: m.machineId as any,
        status: m.status,
        hours: m.hours,
        remarks: m.remarks,
      })),
      issues: data.issues?.map((i) => ({
        type: i.type,
        notes: i.notes,
        machineId: i.machineId ? (i.machineId as any) : undefined,
      })),
      status: "submitted" as const,
      submittedAt: now,
      isLate,
      clientGeneratedId: data.clientGeneratedId,
      version: 1,
    };

    const report = await this.reportRepo.create(tenantId, reportData as any);

    // 6. Update order production stage totals and progress
    if (data.outputs && data.outputs.length > 0) {
      for (const output of data.outputs) {
        try {
          const order = await this.ordersRepo.findById(tenantId, output.orderId);
          if (order) {
            const currentStageTotals = [...(order.production?.stageTotals || [])];
            const stageIndex = currentStageTotals.findIndex((s: any) => s.stage === output.stage);

            if (stageIndex >= 0) {
              const current = currentStageTotals[stageIndex]!;
              currentStageTotals[stageIndex] = {
                stage: output.stage,
                produced: (current.produced || 0) + output.produced,
                defective: (current.defective || 0) + (output.defective || 0),
              };
            } else {
              currentStageTotals.push({
                stage: output.stage,
                produced: output.produced,
                defective: output.defective || 0,
              });
            }

            const totalProduced = (order.production?.producedQty || 0) + output.produced;
            const targetQty = order.quantity || 1;
            const percentComplete = Math.min(100, Math.round((totalProduced / targetQty) * 100));

            await this.ordersRepo.updateProductionProgress(tenantId, output.orderId, {
              phase: output.stage,
              percentComplete,
              producedQty: totalProduced,
              stageTotals: currentStageTotals,
            });

            // If order was in assigned, transition to in_production
            if (order.status === OrderStatus.ASSIGNED) {
              await this.ordersRepo.updateStatus(tenantId, output.orderId, OrderStatus.IN_PRODUCTION);
            }
          }
        } catch (err) {
          // Continue processing remaining outputs
        }
      }
    }

    // 7. Synchronize machine status and auto-create maintenance tickets on breakdown
    if (data.machines && data.machines.length > 0) {
      for (const m of data.machines) {
        try {
          if (m.status === "breakdown") {
            await this.ticketService.createTicket(
              tenantId,
              actor,
              {
                machineId: m.machineId,
                issue: m.remarks || "Breakdown reported in daily supervisor report",
                sourceReportId: String(report._id),
              }
            );
          } else {
            let machine = null;
            if (Types.ObjectId.isValid(m.machineId)) {
              machine = await this.machineRepo.findById(tenantId, m.machineId);
            }
            if (!machine) {
              machine = await this.machineRepo.findOne(tenantId, { machineCode: m.machineId.toUpperCase() });
            }
            if (!machine) continue;
            const resolvedMachineId = String(machine._id);

            await this.unitOfWork.withTransaction(async (tx) => {
              const lockedMachine = await this.machineRepo.lockMachine(tenantId, resolvedMachineId, tx);
              if (!lockedMachine || lockedMachine.currentStatus === "inactive") {
                return;
              }

              // Guard: Cannot mark machine available if unresolved breakdown tickets exist
              if (m.status === "available") {
                const unresolved = await this.ticketRepo.findUnresolvedTicketsForMachine(
                  tenantId,
                  lockedMachine._id,
                  undefined,
                  tx
                );
                if (unresolved.length > 0) {
                  return;
                }
              }

              if (lockedMachine.currentStatus !== m.status) {
                await this.machineRepo.updateMachineStatus(tenantId, resolvedMachineId, m.status, tx);
              }
            });
          }
        } catch (err) {
          // Continue processing
        }
      }
    }

    // Check issues for machine breakdowns not already handled
    if (data.issues && data.issues.length > 0) {
      for (const issue of data.issues) {
        if (issue.type === "machine" && issue.machineId) {
          const alreadyCreated = (data.machines || []).some(
            (m) => m.machineId === issue.machineId && m.status === "breakdown"
          );
          if (!alreadyCreated) {
            try {
              await this.ticketService.createTicket(
                tenantId,
                actor,
                {
                  machineId: issue.machineId,
                  issue: issue.notes,
                  sourceReportId: String(report._id),
                }
              );
            } catch (err) {
              // Continue processing
            }
          }
        }
      }
    }

    // 8. Audit logging
    await this.auditService.log({
      tenantId,
      actor: { id: actor.id, type: "user", email: actor.email },
      action: "SUPERVISOR_REPORT_SUBMITTED",
      entity: { collection: "supervisorDailyReports", id: String(report._id) },
      after: {
        reportDate: data.reportDate,
        isLate,
        status: "submitted",
        outputsCount: data.outputs?.length || 0,
      },
    });

    return report;
  }

  async listSupervisorReports(
    tenantId: string,
    supervisorId: string,
    query: {
      reportDate?: string;
      status?: string;
      isLate?: string;
      fromDate?: string;
      toDate?: string;
      page?: number | string;
      limit?: number | string;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
    }
  ): Promise<PaginatedResult<any>> {
    const filter: Record<string, any> = { supervisorId };
    if (query.reportDate) filter.reportDate = query.reportDate;
    if (query.status) filter.status = query.status;
    if (query.isLate !== undefined) filter.isLate = query.isLate === "true";
    if (query.fromDate) filter.fromDate = query.fromDate;
    if (query.toDate) filter.toDate = query.toDate;

    const pagination: PaginationQuery = {
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 20,
      sortOrder: query.sortOrder || "desc",
      sortBy: query.sortBy,
    };

    return this.reportRepo.findPaginatedReports(tenantId, filter, pagination);
  }

  async listAdminSupervisorReports(
    tenantId: string,
    query: {
      supervisorId?: string;
      reportDate?: string;
      status?: string;
      isLate?: string;
      fromDate?: string;
      toDate?: string;
      page?: number | string;
      limit?: number | string;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
    }
  ): Promise<PaginatedResult<any>> {
    const filter: Record<string, any> = {};
    if (query.supervisorId) filter.supervisorId = query.supervisorId;
    if (query.reportDate) filter.reportDate = query.reportDate;
    if (query.status) filter.status = query.status;
    if (query.isLate !== undefined) filter.isLate = query.isLate === "true";
    if (query.fromDate) filter.fromDate = query.fromDate;
    if (query.toDate) filter.toDate = query.toDate;

    const pagination: PaginationQuery = {
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 20,
      sortOrder: query.sortOrder || "desc",
      sortBy: query.sortBy,
    };

    return this.reportRepo.findPaginatedReports(tenantId, filter, pagination);
  }

  async getReportById(
    tenantId: string,
    reportId: string,
    actor: { id: string; role?: string }
  ): Promise<any> {
    const report = await this.reportRepo.findById(tenantId, reportId);
    if (!report) {
      throw new AppError(ErrorCode.NOT_FOUND, "Supervisor daily report not found", 404);
    }

    if (actor.role === "supervisor" && String(report.supervisorId) !== String(actor.id)) {
      throw new AppError(ErrorCode.FORBIDDEN, "Access denied: Report belongs to another supervisor", 403);
    }

    return report;
  }

  async correctReport(
    tenantId: string,
    reportId: string,
    actor: { id: string; type?: string; email?: string; role?: string },
    data: {
      reason: string;
      employeesPresentTotal?: number;
      workforce?: Array<{ area: string; count: number }>;
      resources?: { machinesAvail: number; machinesDown?: number };
      stockCounts?: Array<{ materialId: string; qty: number }>;
      outputs?: Array<{ orderId: string; stage: string; produced: number; defective?: number }>;
      machines?: Array<{ machineId: string; status: "available" | "maint" | "breakdown"; hours: number; remarks?: string }>;
      issues?: Array<{ type: "machine" | "shortage" | "delay" | "quality" | "other"; notes: string; machineId?: string }>;
    }
  ): Promise<any> {
    const report = await this.reportRepo.findById(tenantId, reportId);
    if (!report) {
      throw new AppError(ErrorCode.NOT_FOUND, "Supervisor daily report not found", 404);
    }

    if (actor.role === "supervisor" && String(report.supervisorId) !== String(actor.id)) {
      throw new AppError(ErrorCode.FORBIDDEN, "Access denied: Report belongs to another supervisor", 403);
    }

    // Workforce validation if updated
    if (data.workforce && data.workforce.length > 0) {
      const targetTotal =
        data.employeesPresentTotal !== undefined ? data.employeesPresentTotal : report.employeesPresentTotal;
      const sum = data.workforce.reduce((acc, w) => acc + (w.count || 0), 0);
      if (sum !== targetTotal) {
        throw new AppError(
          ErrorCode.VALIDATION_FAILED,
          `Workforce count sum (${sum}) must equal employeesPresentTotal (${targetTotal})`,
          400
        );
      }
    }

    const correction = {
      reason: data.reason,
      by: actor.id as any,
      at: new Date(),
    };

    const updates: Record<string, any> = {};
    if (data.employeesPresentTotal !== undefined) updates.employeesPresentTotal = data.employeesPresentTotal;
    if (data.workforce !== undefined) updates.workforce = data.workforce;
    if (data.resources !== undefined) updates.resources = data.resources;
    if (data.stockCounts !== undefined) {
      updates.stockCounts = data.stockCounts.map((s) => ({ materialId: s.materialId as any, qty: s.qty }));
    }
    if (data.outputs !== undefined) {
      updates.outputs = data.outputs.map((o) => ({
        orderId: o.orderId as any,
        stage: o.stage,
        produced: o.produced,
        defective: o.defective || 0,
      }));
    }
    if (data.machines !== undefined) {
      updates.machines = data.machines.map((m) => ({
        machineId: m.machineId as any,
        status: m.status,
        hours: m.hours,
        remarks: m.remarks,
      }));
    }
    if (data.issues !== undefined) {
      updates.issues = data.issues.map((i) => ({
        type: i.type,
        notes: i.notes,
        machineId: i.machineId ? (i.machineId as any) : undefined,
      }));
    }

    const updated = await this.reportRepo.addCorrection(tenantId, reportId, correction, updates);
    if (!updated) {
      throw new AppError(ErrorCode.NOT_FOUND, "Supervisor daily report not found", 404);
    }

    await this.auditService.log({
      tenantId,
      actor: { id: actor.id, type: "user", email: actor.email },
      action: "SUPERVISOR_REPORT_CORRECTED",
      entity: { collection: "supervisorDailyReports", id: reportId },
      before: { status: report.status },
      after: { status: "corrected", reason: data.reason },
    });

    return updated;
  }
}
