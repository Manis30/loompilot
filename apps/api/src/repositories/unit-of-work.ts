import mongoose from "mongoose";
import { IUnitOfWork, TxContext } from "../interfaces/unit-of-work.js";

export class MongoUnitOfWork implements IUnitOfWork {
  async run<T>(fn: (tx: TxContext) => Promise<T>): Promise<T> {
    const session = await mongoose.startSession();
    try {
      return await session.withTransaction(async () => {
        return fn({ session });
      });
    } finally {
      await session.endSession();
    }
  }
}
