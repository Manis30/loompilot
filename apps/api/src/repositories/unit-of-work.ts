import mongoose from "mongoose";
import { IUnitOfWork, TxContext } from "../interfaces/unit-of-work.js";

export class MongoUnitOfWork implements IUnitOfWork {
  async run<T>(fn: (tx: TxContext) => Promise<T>): Promise<T> {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const result = await fn({ session });
      await session.commitTransaction();
      return result;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      await session.endSession();
    }
  }
}

export class FakeUnitOfWork implements IUnitOfWork {
  async run<T>(fn: (tx: TxContext) => Promise<T>): Promise<T> {
    return fn({ session: null });
  }
}

