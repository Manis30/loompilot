import { ErrorCode } from "@loompilot/shared";

export class AppError extends Error {
  public readonly code: ErrorCode | string;
  public readonly statusCode: number;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(
    code: ErrorCode | string,
    message: string,
    statusCode = 500,
    details?: unknown,
    isOperational = true
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details?: unknown) {
    super(ErrorCode.VALIDATION_FAILED, message, 400, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required", details?: unknown) {
    super(ErrorCode.UNAUTHENTICATED, message, 401, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access denied", details?: unknown) {
    super(ErrorCode.FORBIDDEN, message, 403, details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Resource", details?: unknown) {
    super(ErrorCode.NOT_FOUND, `${resource} not found`, 404, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource conflict", details?: unknown) {
    super(ErrorCode.DUPLICATE, message, 409, details);
  }
}

export class VersionConflictError extends AppError {
  constructor(message = "Concurrent update detected. Please reload.", details?: unknown) {
    super(ErrorCode.VERSION_CONFLICT, message, 409, details);
  }
}

export class InvalidTransitionError extends AppError {
  constructor(from: string, to: string, entity = "Entity") {
    super(
      ErrorCode.INVALID_TRANSITION,
      `Cannot transition ${entity} from '${from}' to '${to}'`,
      422,
      { from, to, entity }
    );
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Rate limit exceeded. Please try again later.") {
    super(ErrorCode.RATE_LIMITED, message, 429);
  }
}

export class InternalError extends AppError {
  constructor(message = "Internal server error", details?: unknown) {
    super(ErrorCode.INTERNAL_ERROR, message, 500, details, false);
  }
}

