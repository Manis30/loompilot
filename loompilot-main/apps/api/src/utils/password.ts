import bcrypt from "bcrypt";
import { getEnv } from "../config/env.js";
import { AppError } from "../errors/app-error.js";
import { ErrorCode } from "@loompilot/shared";

// Pre-computed salt/hash used to perform constant-time bcrypt compare when user is not found
const DUMMY_HASH = "$2b$12$DUMMY.HASH.FOR.CONSTANT.TIME.MITIGATION.00000000000000000000";

export function validatePasswordPolicy(password: string): void {
  if (typeof password !== "string") {
    throw new AppError(
      ErrorCode.VALIDATION_FAILED,
      "Password must be a string",
      400
    );
  }

  if (password.length < 10) {
    throw new AppError(
      ErrorCode.VALIDATION_FAILED,
      "Password must be at least 10 characters long",
      400,
      { minLength: 10, actualLength: password.length }
    );
  }

  const byteLength = Buffer.byteLength(password, "utf8");
  if (byteLength > 72) {
    throw new AppError(
      ErrorCode.VALIDATION_FAILED,
      "Password exceeds maximum allowed bcrypt length of 72 bytes",
      400,
      { maxBytes: 72, actualBytes: byteLength }
    );
  }
}

export async function hashPassword(password: string): Promise<string> {
  validatePasswordPolicy(password);
  const rounds = getEnv().BCRYPT_ROUNDS;
  return bcrypt.hash(password, rounds);
}

export async function comparePassword(
  plainText: string,
  hashedPassword: string
): Promise<boolean> {
  if (!plainText || !hashedPassword) return false;
  return bcrypt.compare(plainText, hashedPassword);
}

export async function runDummyHash(passwordToCompare = "dummy_password_timing"): Promise<void> {
  try {
    await bcrypt.compare(passwordToCompare, DUMMY_HASH);
  } catch {
    // Suppress dummy comparison failures
  }
}
