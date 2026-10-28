import { Request, Response, NextFunction } from "express";
import { UserRole } from "@loompilot/shared";

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: "Unauthorized",
        message: "User authentication required",
        requestId: req.requestId,
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: "Forbidden",
        message: `Role '${req.user.role}' is not authorized to access this resource`,
        requestId: req.requestId,
      });
      return;
    }

    next();
  };
}

/**
 * Strips sensitive cost and margin fields when a store user reads items.
 * Enforces Rule 1 of the Role-Permission Matrix:
 * 'store cannot read cost or margin'
 */
const SENSITIVE_FINANCIAL_FIELDS = new Set([
  "unitCostPaise",
  "totalCostPaise",
  "materialCostPaise",
  "processingCostPaise",
  "overheadCostPaise",
  "wastageCostPaise",
  "riskBufferCostPaise",
  "subtotalCostPaise",
  "profitPaise",
  "marginPct",
  "riskBufferPct",
  "currentRatePaise",
  "avgCostPaise",
]);

export function sanitizeFinancialData(data: any, role: UserRole): any {
  if (role !== UserRole.STORE) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeFinancialData(item, role));
  }

  if (data !== null && typeof data === "object") {
    // If it's a Mongoose document, convert to object
    const obj = typeof data.toObject === "function" ? data.toObject() : { ...data };
    const sanitized: Record<string, any> = {};

    for (const [key, val] of Object.entries(obj)) {
      if (SENSITIVE_FINANCIAL_FIELDS.has(key)) {
        continue; // Strip sensitive field
      }
      if (key === "lineItems" && Array.isArray(val)) {
        sanitized[key] = val.map((item) => sanitizeFinancialData(item, role));
      } else if (typeof val === "object" && val !== null && !(val instanceof Date)) {
        sanitized[key] = sanitizeFinancialData(val, role);
      } else {
        sanitized[key] = val;
      }
    }
    return sanitized;
  }

  return data;
}

export function maskFinancialDataMiddleware(req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json.bind(res);

  res.json = function (body: any): Response {
    if (req.user?.role === UserRole.STORE && body) {
      if (body.data) {
        body.data = sanitizeFinancialData(body.data, req.user.role);
      } else {
        body = sanitizeFinancialData(body, req.user.role);
      }
    }
    return originalJson(body);
  };

  next();
}

