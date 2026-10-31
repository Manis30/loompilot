import { BaseRepository } from "./base.repository.js";
import { ICounter, CounterModel } from "../models/platform/counter.model.js";
import { TxContext } from "../interfaces/unit-of-work.interface.js";

export class CounterRepository extends BaseRepository<ICounter> {
  constructor() {
    super(CounterModel);
  }

  async getNextSequence(tenantId: string, key: string, tx?: TxContext): Promise<number> {
    const session = this.getSession(tx);
    const result = await this.model.findOneAndUpdate(
      { tenantId, key },
      { $inc: { seq: 1 }, $setOnInsert: { version: 1 } },
      { new: true, upsert: true, session: session ?? null }
    );
    return result.seq;
  }
}
