export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number = 500,
    public readonly code: string = "INTERNAL_ERROR",
    public readonly details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found", details?: any) {
    super(message, 404, "NOT_FOUND", details);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = "Validation failed", details?: any) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = "Bad request", details?: any) {
    super(message, 400, "BAD_REQUEST", details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized", details?: any) {
    super(message, 401, "UNAUTHORIZED", details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden", details?: any) {
    super(message, 403, "FORBIDDEN", details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = "Resource conflict", details?: any) {
    super(message, 409, "CONFLICT", details);
  }
}
