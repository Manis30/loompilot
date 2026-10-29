import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { ErrorCode } from "@loompilot/shared";

export function validate(schema: ZodSchema, source: "body" | "query" | "params" = "body") {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync(req[source]);
      req[source] = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({
          error: {
            code: ErrorCode.VALIDATION_FAILED,
            message: "Request validation failed",
            details: err.errors,
            requestId: req.requestId,
          },
        });
        return;
      }
      next(err);
    }
  };
}
