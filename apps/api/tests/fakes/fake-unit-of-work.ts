import { IUnitOfWork, TxContext } from "../../src/interfaces/unit-of-work.js";

export class FakeUnitOfWork implements IUnitOfWork {
  async run<T>(fn: (tx: TxContext) => Promise<T>): Promise<T> {
    return fn({ session: null });
  }
}

