import { IProcessRepository, Process, NewProcess } from "../interfaces/process.repository.js";
import { TxContext } from "../interfaces/unit-of-work.js";
import { ListQuery, Page, toPage } from "../utils/pagination.js";
import { ProcessModel } from "../models/process.model.js";
import { ProcessName } from "@loompilot/shared";

export class MongoProcessRepository implements IProcessRepository {
  private toEntity(doc: any): Process {
    return {
      id: doc._id.toString(),
      tenantId: doc.tenantId,
      name: doc.name,
      sequence: doc.sequence,
      standardWastagePct: doc.standardWastagePct,
      avgOutputPerWorkerHour: doc.avgOutputPerWorkerHour,
      unit: doc.unit,
      costPerUnitPaise: doc.costPerUnitPaise || 0,
      active: doc.active ?? true,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async create(data: NewProcess, tx?: TxContext): Promise<Process> {
    const docs = await ProcessModel.create([data], { session: tx?.session || null });
    return this.toEntity(docs[0]!);
  }

  async findById(tenantId: string, id: string, tx?: TxContext): Promise<Process | null> {
    const doc = await ProcessModel.findOne({ _id: id, tenantId })
      .session(tx?.session || null)
      .lean();
    return doc ? this.toEntity(doc) : null;
  }

  async findByName(
    tenantId: string,
    name: ProcessName,
    tx?: TxContext
  ): Promise<Process | null> {
    const doc = await ProcessModel.findOne({ tenantId, name })
      .session(tx?.session || null)
      .lean();
    return doc ? this.toEntity(doc) : null;
  }

  async list(tenantId: string, query?: ListQuery): Promise<Page<Process>> {
    const page = query?.page || 1;
    const limit = query?.limit || 50;
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      ProcessModel.find({ tenantId })
        .sort({ sequence: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ProcessModel.countDocuments({ tenantId }),
    ]);

    return toPage(
      docs.map((d) => this.toEntity(d)),
      total,
      page,
      limit
    );
  }

  async listAllOrdered(tenantId: string, tx?: TxContext): Promise<Process[]> {
    const docs = await ProcessModel.find({ tenantId })
      .sort({ sequence: 1 })
      .session(tx?.session || null)
      .lean();
    return docs.map((d) => this.toEntity(d));
  }

  async update(
    tenantId: string,
    id: string,
    data: Partial<Process>,
    tx?: TxContext
  ): Promise<Process | null> {
    const doc = await ProcessModel.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: data },
      { new: true, session: tx?.session || null }
    ).lean();
    return doc ? this.toEntity(doc) : null;
  }
}
