import { ErrorCode } from "@loompilot/shared";

export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number = 500,
    public readonly code: ErrorCode | string = ErrorCode.INTERNAL_ERROR,
    public readonly details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found", details?: any) {
    super(message, 404, ErrorCode.NOT_FOUND, details);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = "Validation failed", details?: any) {
    super(message, 400, ErrorCode.VALIDATION_FAILED, details);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = "Bad request", details?: any, code: ErrorCode | string = ErrorCode.VALIDATION_FAILED) {
    super(message, 400, code, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Authentication required", details?: any) {
    super(message, 401, ErrorCode.UNAUTHENTICATED, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Access forbidden", details?: any) {
    super(message, 403, ErrorCode.FORBIDDEN, details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = "Resource conflict", details?: any, code: ErrorCode | string = ErrorCode.DUPLICATE) {
    super(message, 409, code, details);
  }
}

export class VersionConflictError extends AppError {
  constructor(message: string = "Document version conflict", details?: any) {
    super(message, 409, ErrorCode.VERSION_CONFLICT, details);
  }
}

export class IdempotencyConflictError extends AppError {
  constructor(message: string = "Idempotency key has already been used with a different request payload", details?: any) {
    super(message, 409, ErrorCode.IDEMPOTENCY_CONFLICT, details);
  }
}

export class InvalidTransitionError extends AppError {
  constructor(message: string = "Invalid lifecycle state transition", details?: any) {
    super(message, 400, ErrorCode.INVALID_TRANSITION, details);
  }
}

export class RateLimitedError extends AppError {
  constructor(message: string = "Too many requests, please try again later", details?: any) {
    super(message, 429, ErrorCode.RATE_LIMITED, details);
  }
}
