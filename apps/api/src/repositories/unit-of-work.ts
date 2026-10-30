import mongoose, { ClientSession } from "mongoose";
import { IUnitOfWork, TxContext } from "../interfaces/unit-of-work.interface.js";
import { logger } from "../utils/logger.js";

export const MAX_TRANSACTION_ATTEMPTS = 3;
export const MAX_COMMIT_ATTEMPTS = 3;

export function hasErrorLabel(error: unknown, label: string): boolean {
  if (!error || typeof error !== "object") return false;

  const mongoErr = error as {
    hasErrorLabel?: (label: string) => boolean;
    errorLabels?: string[];
  };

  if (typeof mongoErr.hasErrorLabel === "function") {
    return mongoErr.hasErrorLabel(label);
  }

  if (Array.isArray(mongoErr.errorLabels)) {
    return mongoErr.errorLabels.includes(label);
  }

  return false;
}

export function isRetryableTransactionError(error: unknown): boolean {
  return (
    hasErrorLabel(error, "TransientTransactionError") ||
    hasErrorLabel(error, "UnknownTransactionCommitResult")
  );
}

/**
 * Executes a unit of work inside an atomic MongoDB multi-document transaction.
 *
 * Resilience and Retry Policy:
 * 1. TransientTransactionError (e.g. WriteConflict, temporary network drop):
 *    Re-runs the entire transaction (new session, fresh transaction, re-executing callback)
 *    up to MAX_TRANSACTION_ATTEMPTS (3).
 * 2. UnknownTransactionCommitResult (e.g. network timeout during commit acknowledgment):
 *    Retries ONLY the commitTransaction() step without re-executing the callback, preventing
 *    duplicate execution of business logic or side effects.
 *
 * CRITICAL REQUIREMENT:
 * Work callbacks MUST BE IDEMPOTENT because TransientTransactionError retries
 * will re-execute the callback from the beginning.
 */
export class MongoUnitOfWork implements IUnitOfWork {
  async withTransaction<T>(
    work: (tx: TxContext) => Promise<T>,
    existingTx?: TxContext
  ): Promise<T> {
    if (existingTx?.session) {
      // Reuse active parent transaction session
      return work(existingTx);
    }

    let transactionAttempt = 0;
    let lastError: unknown;

    while (transactionAttempt < MAX_TRANSACTION_ATTEMPTS) {
      transactionAttempt++;
      const session: ClientSession = await mongoose.startSession();

      try {
        session.startTransaction();

        // 1. Execute the work callback
        const result = await work({ session });

        // 2. Commit transaction with dedicated UnknownTransactionCommitResult retry loop
        let commitAttempt = 0;
        while (commitAttempt < MAX_COMMIT_ATTEMPTS) {
          commitAttempt++;
          try {
            await session.commitTransaction();
            return result;
          } catch (commitError) {
            if (
              hasErrorLabel(commitError, "UnknownTransactionCommitResult") &&
              commitAttempt < MAX_COMMIT_ATTEMPTS
            ) {
              logger.warn(
                { commitAttempt, maxCommitAttempts: MAX_COMMIT_ATTEMPTS },
                "UnknownTransactionCommitResult during commit; retrying commit only without re-running work..."
              );
              continue;
            }
            // If commit failed with TransientTransactionError or non-retryable error, throw to outer handler
            throw commitError;
          }
        }

        return result;
      } catch (error) {
        lastError = error;

        if (session.inTransaction()) {
          try {
            await session.abortTransaction();
          } catch {
            // Suppress errors during abort
          }
        }

        // Retry the entire transaction only if labeled TransientTransactionError
        if (
          transactionAttempt < MAX_TRANSACTION_ATTEMPTS &&
          hasErrorLabel(error, "TransientTransactionError")
        ) {
          logger.warn(
            { transactionAttempt, maxAttempts: MAX_TRANSACTION_ATTEMPTS },
            "TransientTransactionError detected; re-running entire transaction..."
          );
          continue;
        }

        logger.error({ err: error, transactionAttempt }, "UnitOfWork transaction failed");
        throw error;
      } finally {
        await session.endSession();
      }
    }

    throw lastError;
  }
}
