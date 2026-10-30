import { describe, it, expect } from "vitest";
import mongoose, { Schema, Document, ClientSession } from "mongoose";
import {
  MongoUnitOfWork,
  hasErrorLabel,
  isRetryableTransactionError,
  MAX_TRANSACTION_ATTEMPTS,
} from "../../src/repositories/unit-of-work.js";

interface ITestDoc extends Document {
  tenantId: string;
  name: string;
}

const TestDocSchema = new Schema<ITestDoc>({
  tenantId: { type: String, required: true },
  name: { type: String, required: true },
});

const TestDocModel = mongoose.model<ITestDoc>("TestDoc", TestDocSchema);

class FakeMongoTransientError extends Error {
  public errorLabels: string[];
  constructor(label: string) {
    super(`Mongo transaction failure with label: ${label}`);
    this.name = "MongoServerError";
    this.errorLabels = [label];
  }
  hasErrorLabel(label: string): boolean {
    return this.errorLabels.includes(label);
  }
}

describe("UnitOfWork (MongoDB Transactions with Transient Retry)", () => {
  const uow = new MongoUnitOfWork();

  it("commits transactions when operations succeed", async () => {
    const name = `commit_test_${Date.now()}`;

    await uow.withTransaction(async (tx) => {
      const session = tx.session as ClientSession;
      await TestDocModel.create([{ tenantId: "tenant_1", name }], { session });
    });

    const found = await TestDocModel.findOne({ tenantId: "tenant_1", name });
    expect(found).not.toBeNull();
    expect(found?.name).toBe(name);
  });

  it("rolls back transactions when an error is thrown inside work callback", async () => {
    const name = `rollback_test_${Date.now()}`;

    await expect(
      uow.withTransaction(async (tx) => {
        const session = tx.session as ClientSession;
        await TestDocModel.create([{ tenantId: "tenant_1", name }], { session });
        throw new Error("Deliberate failure to trigger rollback");
      })
    ).rejects.toThrow("Deliberate failure to trigger rollback");

    // Verify document was NOT committed to database
    const found = await TestDocModel.findOne({ tenantId: "tenant_1", name });
    expect(found).toBeNull();
  });

  it("recognizes TransientTransactionError and UnknownTransactionCommitResult", () => {
    const transientErr = new FakeMongoTransientError("TransientTransactionError");
    const commitErr = new FakeMongoTransientError("UnknownTransactionCommitResult");
    const normalErr = new Error("Regular business logic failure");

    expect(hasErrorLabel(transientErr, "TransientTransactionError")).toBe(true);
    expect(hasErrorLabel(commitErr, "UnknownTransactionCommitResult")).toBe(true);
    expect(isRetryableTransactionError(transientErr)).toBe(true);
    expect(isRetryableTransactionError(commitErr)).toBe(true);
    expect(isRetryableTransactionError(normalErr)).toBe(false);
  });

  it("handles TransientTransactionError by re-running the entire transaction", async () => {
    let workExecutionCount = 0;
    const name = `transient_retry_${Date.now()}`;

    const result = await uow.withTransaction(async (tx) => {
      workExecutionCount++;
      if (workExecutionCount === 1) {
        throw new FakeMongoTransientError("TransientTransactionError");
      }
      const session = tx.session as ClientSession;
      const [doc] = await TestDocModel.create([{ tenantId: "tenant_1", name }], { session });
      return doc?.name;
    });

    // Proves callback was re-run due to TransientTransactionError
    expect(workExecutionCount).toBe(2);
    expect(result).toBe(name);

    const found = await TestDocModel.findOne({ tenantId: "tenant_1", name });
    expect(found).not.toBeNull();
  });

  it("handles UnknownTransactionCommitResult by retrying ONLY the commit (work callback executes once)", async () => {
    let workExecutionCount = 0;
    let commitAttempts = 0;
    const name = `commit_retry_${Date.now()}`;

    const result = await uow.withTransaction(async (tx) => {
      workExecutionCount++;
      const session = tx.session as ClientSession;

      // Intercept commitTransaction on this session to simulate UnknownTransactionCommitResult on first commit attempt
      const originalCommit = session.commitTransaction.bind(session);
      session.commitTransaction = async () => {
        commitAttempts++;
        if (commitAttempts === 1) {
          throw new FakeMongoTransientError("UnknownTransactionCommitResult");
        }
        return originalCommit();
      };

      const [doc] = await TestDocModel.create([{ tenantId: "tenant_1", name }], { session });
      return doc?.name;
    });

    // Critical assertion: Work callback must execute ONLY ONCE (not re-run)
    expect(workExecutionCount).toBe(1);
    // Commit was retried
    expect(commitAttempts).toBe(2);
    expect(result).toBe(name);

    const found = await TestDocModel.findOne({ tenantId: "tenant_1", name });
    expect(found).not.toBeNull();
  });

  it("does NOT retry on regular non-transient errors (executes exactly once)", async () => {
    let callCount = 0;

    await expect(
      uow.withTransaction(async () => {
        callCount++;
        throw new Error("Regular validation failure");
      })
    ).rejects.toThrow("Regular validation failure");

    expect(callCount).toBe(1);
  });

  it("throws after exhausting max 3 attempts on continuous transient errors", async () => {
    let callCount = 0;

    await expect(
      uow.withTransaction(async () => {
        callCount++;
        throw new FakeMongoTransientError("TransientTransactionError");
      })
    ).rejects.toThrow(/TransientTransactionError/);

    expect(callCount).toBe(MAX_TRANSACTION_ATTEMPTS);
  });
});
