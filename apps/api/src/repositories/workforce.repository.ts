import {
  IWorkforceRepository,
  Worker,
  NewWorker,
  UpdateWorkerInput,
  AttendanceRecord,
  AttendanceItem,
  DailyOutput,
  NewDailyOutput,
} from "../interfaces/workforce.repository.js";
import { TxContext } from "../interfaces/unit-of-work.js";
import { ListQuery, Page, toPage } from "../utils/pagination.js";
import {
  WorkerModel,
  AttendanceModel,
  DailyOutputModel,
} from "../models/workforce.model.js";

export class MongoWorkforceRepository implements IWorkforceRepository {
  private toWorker(doc: any): Worker {
    return {
      id: doc._id.toString(),
      tenantId: doc.tenantId,
      workerCode: doc.workerCode,
      name: doc.name,
      skillLevel: doc.skillLevel,
      hourlyRatePaise: doc.hourlyRatePaise,
      assignedProcessId: doc.assignedProcessId?.toString(),
      active: doc.active,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  private toAttendance(doc: any): AttendanceRecord {
    return {
      id: doc._id.toString(),
      tenantId: doc.tenantId,
      workerId: doc.workerId?._id ? doc.workerId._id.toString() : doc.workerId.toString(),
      workerName: doc.workerId?.name,
      date: doc.date,
      processId: doc.processId?.toString(),
      shift: doc.shift || "morning",
      status: doc.status || (doc.isPresent ? "present" : "absent"),
      isPresent: doc.isPresent ?? (doc.status !== "absent"),
      hoursWorked: doc.hoursWorked,
      createdAt: doc.createdAt,
    };
  }

  private toDailyOutput(doc: any): DailyOutput {
    return {
      id: doc._id.toString(),
      tenantId: doc.tenantId,
      orderId: doc.orderId.toString(),
      processId: doc.processId.toString(),
      date: doc.date,
      entries: (doc.entries || []).map((e: any) => ({
        workerId: e.workerId?.toString(),
        hoursWorked: e.hoursWorked,
        quantityProduced: e.quantityProduced,
        quantityDefective: e.quantityDefective || 0,
        hourlyRatePaiseSnapshot: e.hourlyRatePaiseSnapshot || 0,
      })),
      labourCostPaise: doc.labourCostPaise || 0,
      quantityProduced: doc.quantityProduced,
      quantityDefective: doc.quantityDefective || 0,
      operatorId: doc.operatorId,
      notes: doc.notes,
      idempotencyKey: doc.idempotencyKey,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async createWorker(data: NewWorker, tx?: TxContext): Promise<Worker> {
    const docs = await WorkerModel.create([data], { session: tx?.session || null });
    return this.toWorker(docs[0]!);
  }

  async findWorkerById(tenantId: string, id: string, tx?: TxContext): Promise<Worker | null> {
    const doc = await WorkerModel.findOne({ _id: id, tenantId })
      .session(tx?.session || null)
      .lean();
    return doc ? this.toWorker(doc) : null;
  }

  async findWorkerByCode(
    tenantId: string,
    workerCode: string,
    tx?: TxContext
  ): Promise<Worker | null> {
    const doc = await WorkerModel.findOne({ tenantId, workerCode })
      .session(tx?.session || null)
      .lean();
    return doc ? this.toWorker(doc) : null;
  }

  async updateWorker(
    tenantId: string,
    id: string,
    data: UpdateWorkerInput,
    tx?: TxContext
  ): Promise<Worker | null> {
    const doc = await WorkerModel.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: data },
      { new: true, session: tx?.session || null }
    ).lean();
    return doc ? this.toWorker(doc) : null;
  }

  async listWorkers(tenantId: string, query?: ListQuery): Promise<Page<Worker>> {
    const page = query?.page || 1;
    const limit = query?.limit || 50;
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      WorkerModel.find({ tenantId, active: true })
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      WorkerModel.countDocuments({ tenantId, active: true }),
    ]);

    return toPage(
      docs.map((d) => this.toWorker(d)),
      total,
      page,
      limit
    );
  }

  async recordAttendance(
    tenantId: string,
    records: AttendanceItem[],
    tx?: TxContext
  ): Promise<AttendanceRecord[]> {
    const results: AttendanceRecord[] = [];
    for (const rec of records) {
      const isPresent = rec.status ? rec.status !== "absent" : (rec.isPresent ?? true);
      const status = rec.status || (isPresent ? "present" : "absent");
      const doc = await AttendanceModel.findOneAndUpdate(
        { tenantId, workerId: rec.workerId, date: rec.date },
        {
          $set: {
            isPresent,
            status,
            shift: rec.shift || "morning",
            hoursWorked: rec.hoursWorked ?? 8,
            ...(rec.processId ? { processId: rec.processId } : {}),
          },
        },
        { upsert: true, new: true, session: tx?.session || null }
      ).lean();
      results.push(this.toAttendance(doc));
    }
    return results;
  }

  async getAttendance(tenantId: string, date: string): Promise<AttendanceRecord[]> {
    const docs = await AttendanceModel.find({ tenantId, date })
      .populate("workerId")
      .lean();
    return docs.map((d) => this.toAttendance(d));
  }

  async findDailyOutputByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
    tx?: TxContext
  ): Promise<DailyOutput | null> {
    const doc = await DailyOutputModel.findOne({ tenantId, idempotencyKey })
      .session(tx?.session || null)
      .lean();
    return doc ? this.toDailyOutput(doc) : null;
  }

  async findDailyOutputByOrderProcessDate(
    tenantId: string,
    orderId: string,
    processId: string,
    date: string,
    tx?: TxContext
  ): Promise<DailyOutput | null> {
    const doc = await DailyOutputModel.findOne({
      tenantId,
      orderId,
      processId,
      date,
    })
      .session(tx?.session || null)
      .lean();
    return doc ? this.toDailyOutput(doc) : null;
  }

  async findDailyOutputById(
    tenantId: string,
    id: string,
    tx?: TxContext
  ): Promise<DailyOutput | null> {
    const doc = await DailyOutputModel.findOne({ tenantId, _id: id })
      .session(tx?.session || null)
      .lean();
    return doc ? this.toDailyOutput(doc) : null;
  }

  async upsertDailyOutput(data: NewDailyOutput, tx?: TxContext): Promise<DailyOutput> {
    const doc = await DailyOutputModel.findOneAndUpdate(
      {
        tenantId: data.tenantId,
        orderId: data.orderId,
        processId: data.processId,
        date: data.date,
      },
      {
        $set: {
          entries: data.entries || [],
          labourCostPaise: data.labourCostPaise || 0,
          quantityProduced: data.quantityProduced,
          quantityDefective: data.quantityDefective ?? 0,
          operatorId: data.operatorId,
          notes: data.notes,
          idempotencyKey: data.idempotencyKey,
        },
      },
      { upsert: true, new: true, session: tx?.session || null }
    ).lean();
    return this.toDailyOutput(doc);
  }

  async updateDailyOutput(
    tenantId: string,
    id: string,
    data: Partial<NewDailyOutput>,
    tx?: TxContext
  ): Promise<DailyOutput | null> {
    const doc = await DailyOutputModel.findOneAndUpdate(
      { tenantId, _id: id },
      { $set: data },
      { new: true, session: tx?.session || null }
    ).lean();
    return doc ? this.toDailyOutput(doc) : null;
  }

  async getOutputsForOrder(
    tenantId: string,
    orderId: string,
    tx?: TxContext
  ): Promise<DailyOutput[]> {
    const docs = await DailyOutputModel.find({ tenantId, orderId })
      .sort({ date: 1 })
      .session(tx?.session || null)
      .lean();
    return docs.map((d) => this.toDailyOutput(d));
  }
}


