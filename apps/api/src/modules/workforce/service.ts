import {
  WorkerModel,
  IWorker,
  AttendanceModel,
  IAttendance,
  DailyOutputModel,
  IDailyOutput,
} from "./model.js";

// Event callback or hook for debounced monitoring
type MonitoringTrigger = (tenantId: string, orderId: string) => Promise<void>;
let onDailyOutputSaved: MonitoringTrigger | null = null;

export function registerMonitoringTrigger(trigger: MonitoringTrigger) {
  onDailyOutputSaved = trigger;
}

export class WorkforceService {
  static async listWorkers(tenantId: string): Promise<IWorker[]> {
    return WorkerModel.find({ tenantId, active: true }).sort({ name: 1 });
  }

  static async createWorker(data: Partial<IWorker> & { tenantId: string }): Promise<IWorker> {
    return WorkerModel.create(data);
  }

  static async recordAttendance(
    tenantId: string,
    records: Array<{ workerId: string; date: string; isPresent: boolean; hoursWorked?: number }>
  ): Promise<IAttendance[]> {
    const results: IAttendance[] = [];
    for (const rec of records) {
      const attendance = await AttendanceModel.findOneAndUpdate(
        { tenantId, workerId: rec.workerId, date: rec.date },
        { isPresent: rec.isPresent, hoursWorked: rec.hoursWorked ?? 8 },
        { upsert: true, new: true }
      );
      results.push(attendance);
    }
    return results;
  }

  static async getAttendance(tenantId: string, date: string): Promise<IAttendance[]> {
    return AttendanceModel.find({ tenantId, date }).populate("workerId");
  }

  static async recordDailyOutput(
    data: Partial<IDailyOutput> & {
      tenantId: string;
      orderId: any;
      processId: any;
      date: string;
      quantityProduced: number;
      idempotencyKey: string;
    }
  ): Promise<IDailyOutput> {
    // Check by idempotencyKey first
    const existingByIdempotency = await DailyOutputModel.findOne({
      tenantId: data.tenantId,
      idempotencyKey: data.idempotencyKey,
    });
    if (existingByIdempotency) {
      return existingByIdempotency;
    }

    // Upsert on compound unique index (orderId + processId + date)
    const output = await DailyOutputModel.findOneAndUpdate(
      {
        tenantId: data.tenantId,
        orderId: data.orderId,
        processId: data.processId,
        date: data.date,
      },
      {
        $set: {
          quantityProduced: data.quantityProduced,
          quantityDefective: data.quantityDefective ?? 0,
          operatorId: data.operatorId,
          notes: data.notes,
          idempotencyKey: data.idempotencyKey,
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    // Amendment 2: Event-triggered debounced monitoring run per order
    if (onDailyOutputSaved) {
      onDailyOutputSaved(data.tenantId, data.orderId.toString()).catch(() => {});
    }

    return output;
  }

  static async getOutputsForOrder(tenantId: string, orderId: string): Promise<IDailyOutput[]> {
    return DailyOutputModel.find({ tenantId, orderId }).sort({ date: 1 });
  }
}
