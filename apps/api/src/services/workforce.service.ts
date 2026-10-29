import {
  IWorkforceRepository,
  Worker,
  AttendanceRecord,
  DailyOutput,
  DailyOutputEntry,
} from "../interfaces/workforce.repository.js";
import { IUnitOfWork } from "../interfaces/unit-of-work.js";
import { IAuditLogRepository } from "../interfaces/audit-log.js";
import { Actor } from "../utils/actor.js";
import { ListQuery, Page } from "../utils/pagination.js";
import {
  CreateWorkerInput,
  UpdateWorkerInput,
  RecordAttendanceInput,
  RecordDailyOutputInput,
  UpdateDailyOutputInput,
} from "../validators/workforce.validator.js";
import { ConflictError, NotFoundError, OutputAlreadyRecordedError } from "../errors/index.js";

export type MonitoringTrigger = (tenantId: string, orderId: string) => Promise<void>;

export class WorkforceService {
  private monitoringTrigger: MonitoringTrigger | null = null;

  constructor(
    private readonly repo: IWorkforceRepository,
    private readonly uow: IUnitOfWork,
    private readonly audit?: IAuditLogRepository
  ) { }
  registerMonitoringTrigger(trigger: MonitoringTrigger): void {
    this.monitoringTrigger = trigger;
  }

  async listWorkers(actor: Actor, query?: ListQuery): Promise<Page<Worker>> {
    return this.repo.listWorkers(actor.tenantId, query);
  }

  async createWorker(actor: Actor, input: CreateWorkerInput): Promise<Worker> {
    const existing = await this.repo.findWorkerByCode(actor.tenantId, input.workerCode);
    if (existing) {
      throw new ConflictError(`Worker with code ${input.workerCode} already exists`);
    }

    const worker = await this.repo.createWorker({
      tenantId: actor.tenantId,
      workerCode: input.workerCode,
      name: input.name,
      skillLevel: input.skillLevel,
      hourlyRatePaise: input.hourlyRatePaise,
      assignedProcessId: input.assignedProcessId,
      active: true,
    });

    if (this.audit) {
      await this.audit.record({
        tenantId: actor.tenantId,
        userId: actor.userId,
        userRole: actor.role,
        action: "WORKER_CREATED",
        entity: "worker",
        entityId: worker.id,
        changes: { workerCode: worker.workerCode, name: worker.name },
      });
    }

    return worker;
  }

  async updateWorker(
    actor: Actor,
    id: string,
    input: UpdateWorkerInput
  ): Promise<Worker> {
    const existing = await this.repo.findWorkerById(actor.tenantId, id);
    if (!existing) {
      throw new NotFoundError(`Worker with ID ${id} not found`);
    }

    const updated = await this.repo.updateWorker(actor.tenantId, id, input);
    if (!updated) {
      throw new NotFoundError(`Worker with ID ${id} not found`);
    }

    if (this.audit) {
      await this.audit.record({
        tenantId: actor.tenantId,
        userId: actor.userId,
        userRole: actor.role,
        action: "WORKER_UPDATED",
        entity: "worker",
        entityId: id,
        changes: { before: existing, after: updated },
      });
    }

    return updated;
  }

  async recordAttendance(
    actor: Actor,
    input: RecordAttendanceInput
  ): Promise<AttendanceRecord[]> {
    return this.repo.recordAttendance(actor.tenantId, input.records);
  }

  async getAttendance(actor: Actor, date: string): Promise<AttendanceRecord[]> {
    return this.repo.getAttendance(actor.tenantId, date);
  }

  async recordDailyOutput(
    actor: Actor,
    input: RecordDailyOutputInput
  ): Promise<DailyOutput> {
    let isNewRecord = false;
    const idempotencyKey =
      input.idempotencyKey ||
      `daily_${input.orderId}_${input.processId}_${input.date}`;

    const output = await this.uow.run(async (tx) => {
      // 1. Idempotency check: if output with this key already recorded, return it
      const existingByKey = await this.repo.findDailyOutputByIdempotencyKey(
        actor.tenantId,
        idempotencyKey,
        tx
      );
      if (existingByKey) {
        return existingByKey;
      }

      // 2. Check compound index orderId + processId + date
      const existingByCompound = await this.repo.findDailyOutputByOrderProcessDate(
        actor.tenantId,
        input.orderId,
        input.processId,
        input.date,
        tx
      );
      if (existingByCompound) {
        // Check if idempotent replay (identical output)
        const isQtySame =
          input.quantityProduced === undefined ||
          existingByCompound.quantityProduced === input.quantityProduced;
        const isDefectSame =
          input.quantityDefective === undefined ||
          existingByCompound.quantityDefective === (input.quantityDefective ?? 0);

        if (isQtySame && isDefectSame) {
          return existingByCompound;
        }

        // New payload for same day requires explicit PATCH with reason
        throw new OutputAlreadyRecordedError();
      }

      isNewRecord = true;

      // 3. Labour cost computation and entries resolution
      let labourCostPaise = 0;
      let computedQty = input.quantityProduced ?? 0;
      let computedDefective = input.quantityDefective ?? 0;
      const resolvedEntries: DailyOutputEntry[] = [];

      if (input.entries && input.entries.length > 0) {
        let entryProducedSum = 0;
        let entryDefectiveSum = 0;
        for (const entry of input.entries) {
          let rate = entry.hourlyRatePaiseSnapshot;
          if (rate === undefined) {
            const worker = await this.repo.findWorkerById(actor.tenantId, entry.workerId, tx);
            rate = worker?.hourlyRatePaise || 12000;
          }
          const cost = Math.round(entry.hoursWorked * rate);
          labourCostPaise += cost;
          entryProducedSum += entry.quantityProduced;
          entryDefectiveSum += (entry.quantityDefective || 0);
          resolvedEntries.push({
            workerId: entry.workerId,
            hoursWorked: entry.hoursWorked,
            quantityProduced: entry.quantityProduced,
            quantityDefective: entry.quantityDefective || 0,
            hourlyRatePaiseSnapshot: rate,
          });
        }
        if (input.quantityProduced === undefined) {
          computedQty = entryProducedSum;
        }
        if (input.quantityDefective === undefined) {
          computedDefective = entryDefectiveSum;
        }
      }

      // 4. Upsert daily output on compound orderId + processId + date
      return this.repo.upsertDailyOutput(
        {
          tenantId: actor.tenantId,
          orderId: input.orderId,
          processId: input.processId,
          date: input.date,
          entries: resolvedEntries,
          labourCostPaise,
          quantityProduced: computedQty,
          quantityDefective: computedDefective,
          operatorId: input.operatorId,
          notes: input.notes,
          idempotencyKey,
        },
        tx
      );
    });

    // 5. Amendment 2: Event-triggered debounced monitoring run per order
    if (isNewRecord && this.monitoringTrigger) {
      this.monitoringTrigger(actor.tenantId, input.orderId).catch(() => { });
    }

    if (this.audit) {
      await this.audit.record({
        tenantId: actor.tenantId,
        userId: actor.userId,
        userRole: actor.role,
        action: "DAILY_OUTPUT_RECORDED",
        entity: "daily_output",
        entityId: output.id,
        changes: {
          orderId: input.orderId,
          processId: input.processId,
          date: input.date,
          quantityProduced: output.quantityProduced,
        },
      });
    }

    return output;
  }

  async updateDailyOutput(
    actor: Actor,
    id: string,
    input: UpdateDailyOutputInput
  ): Promise<DailyOutput> {
    const existing = await this.repo.findDailyOutputById(actor.tenantId, id);
    if (!existing) {
      throw new NotFoundError(`Daily output with ID ${id} not found`);
    }

    let labourCostPaise = existing.labourCostPaise;
    let resolvedEntries = existing.entries;
    let quantityProduced = input.quantityProduced ?? existing.quantityProduced;
    let quantityDefective = input.quantityDefective ?? existing.quantityDefective;

    if (input.entries && input.entries.length > 0) {
      labourCostPaise = 0;
      resolvedEntries = [];
      let entryProducedSum = 0;
      let entryDefectiveSum = 0;
      for (const entry of input.entries) {
        let rate = entry.hourlyRatePaiseSnapshot;
        if (rate === undefined) {
          const worker = await this.repo.findWorkerById(actor.tenantId, entry.workerId);
          rate = worker?.hourlyRatePaise || 12000;
        }
        labourCostPaise += Math.round(entry.hoursWorked * rate);
        entryProducedSum += entry.quantityProduced;
        entryDefectiveSum += (entry.quantityDefective || 0);
        resolvedEntries.push({
          workerId: entry.workerId,
          hoursWorked: entry.hoursWorked,
          quantityProduced: entry.quantityProduced,
          quantityDefective: entry.quantityDefective || 0,
          hourlyRatePaiseSnapshot: rate,
        });
      }
      if (input.quantityProduced === undefined) {
        quantityProduced = entryProducedSum;
      }
      if (input.quantityDefective === undefined) {
        quantityDefective = entryDefectiveSum;
      }
    }

    const updated = await this.repo.updateDailyOutput(actor.tenantId, id, {
      entries: resolvedEntries,
      labourCostPaise,
      quantityProduced,
      quantityDefective,
      notes: input.notes ?? existing.notes,
    });

    if (this.monitoringTrigger) {
      this.monitoringTrigger(actor.tenantId, existing.orderId).catch(() => { });
    }

    if (this.audit) {
      await this.audit.record({
        tenantId: actor.tenantId,
        userId: actor.userId,
        userRole: actor.role,
        action: "DAILY_OUTPUT_UPDATED",
        entity: "daily_output",
        entityId: id,
        changes: {
          reason: input.reason,
          before: existing,
          after: updated,
        },
      });
    }

    return updated!;
  }

  async getOutputsForOrder(actor: Actor, orderId: string): Promise<DailyOutput[]> {
    return this.repo.getOutputsForOrder(actor.tenantId, orderId);
  }
}
