import { Request, Response, NextFunction } from "express";
import { getEnv } from "../config/env.js";
import { AppError } from "../errors/app-error.js";
import { ErrorCode } from "@loompilot/shared";

/**
 * Middleware protecting /internal/v1/... routes called by Python AI agents.
 * Validates the shared secret header X-Internal-Secret (or X-Agent-Service-Token).
 */
export function verifyInternalSecret(req: Request, _res: Response, next: NextFunction): void {
  const env = getEnv();
  const secretHeader =
    req.headers["x-internal-secret"] ||
    req.headers["x-agent-service-token"] ||
    req.headers["authorization"]?.replace(/^Bearer\s+/i, "");

  const expectedToken = env.AGENT_SERVICE_TOKEN;

  if (!secretHeader || secretHeader !== expectedToken) {
    throw new AppError(
      ErrorCode.UNAUTHENTICATED,
      "Unauthorized: missing or invalid internal service secret",
      401
    );
  }

  next();
}
