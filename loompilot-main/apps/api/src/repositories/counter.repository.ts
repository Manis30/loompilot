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

  /**
   * Attempts to claim a unique key within the tenant using CounterModel's unique { tenantId: 1, key: 1 } index.
   * If the key already exists (E11000 duplicate key error), returns false.
   * When executed inside a multi-document transaction (tx), aborting the transaction automatically
   * rolls back the claimed key.
   */
  async claimUniqueKey(tenantId: string, key: string, tx?: TxContext): Promise<boolean> {
    const session = this.getSession(tx);
    try {
      await this.model.create(
        [
          {
            tenantId,
            key,
            seq: 1,
            version: 1,
          },
        ],
        session ? { session } : {}
      );
      return true;
    } catch (err: any) {
      if (err?.code === 11000 || err?.code === "11000") {
        return false;
      }
      throw err;
    }
  }
}
