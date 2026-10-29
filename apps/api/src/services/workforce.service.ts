import {
  IWorkforceRepository,
  Worker,
  AttendanceRecord,
  DailyOutput,
} from "../interfaces/workforce.repository.js";
import { IUnitOfWork } from "../interfaces/unit-of-work.js";
import { IAuditLogRepository } from "../interfaces/audit-log.js";
import { Actor } from "../utils/actor.js";
import { ListQuery, Page } from "../utils/pagination.js";
import {
  CreateWorkerInput,
  RecordAttendanceInput,
  RecordDailyOutputInput,
} from "../validators/workforce.validator.js";
import { ConflictError } from "../errors/index.js";

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
    // 1. Idempotency check: if output with this key already recorded, return it
    const existing = await this.repo.findDailyOutputByIdempotencyKey(
      actor.tenantId,
      input.idempotencyKey
    );
    if (existing) {
      return existing;
    }
    const idempotencyKey =
      input.idempotencyKey ||
      `daily_${input.orderId}_${input.processId}_${input.date}`;

    const output = await this.uow.run(async (tx) => {
      // 1. Idempotency check: if output with this key already recorded, return it
      const existing = await this.repo.findDailyOutputByIdempotencyKey(
        actor.tenantId,
        idempotencyKey,
        tx
      );
      if (existing) {
        return existing;
      }

      isNewRecord = true;
      // 2. Upsert daily output on compound orderId + processId + date
      return this.repo.upsertDailyOutput(
        {
          tenantId: actor.tenantId,
          orderId: input.orderId,
          processId: input.processId,
          date: input.date,
          quantityProduced: input.quantityProduced,
          quantityDefective: input.quantityDefective,
          operatorId: input.operatorId,
          notes: input.notes,
          idempotencyKey,
        },
        tx
      );
    });

    // 3. Amendment 2: Event-triggered debounced monitoring run per order
    if (this.monitoringTrigger) {
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
          quantityProduced: input.quantityProduced,
        },
      });
    }

    return output;
  }

  async getOutputsForOrder(actor: Actor, orderId: string): Promise<DailyOutput[]> {
    return this.repo.getOutputsForOrder(actor.tenantId, orderId);
  }
}
