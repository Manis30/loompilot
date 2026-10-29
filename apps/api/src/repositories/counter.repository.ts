import { ICounterRepository } from "../interfaces/counter.repository.js";
import { TxContext } from "../interfaces/unit-of-work.js";
import { CounterModel } from "../models/counter.model.js";

export class MongoCounterRepository implements ICounterRepository {
  async getNextSequence(tenantId: string, entity: string, tx?: TxContext): Promise<number> {
    const result = await CounterModel.findOneAndUpdate(
      { tenantId, entity },
      { $inc: { seq: 1 } },
      {
        new: true,
        upsert: true,
        session: tx?.session || null,
        setDefaultsOnInsert: true,
      }
    );
    return result.seq;
  }

  async getNextDocumentNumber(
    tenantId: string,
    entity: string,
    prefix: string,
    digits: number = 5,
    tx?: TxContext
  ): Promise<string> {
    const seq = await this.getNextSequence(tenantId, entity, tx);
    return `${prefix}-${String(seq).padStart(digits, "0")}`;
  }
}

