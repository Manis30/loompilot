import { Request, Response, NextFunction } from "express";
import { ROUTE_PERMISSION_MATRIX, RoutePermission } from "@loompilot/shared";
import { AppError } from "../errors/app-error.js";
import { ErrorCode } from "@loompilot/shared";

/**
 * Resolves the canonical route key for a request against ROUTE_PERMISSION_MATRIX.
 */
export function resolveRouteKey(req: Request): string {
  const method = req.method.toUpperCase();
  // If req.route exists (standard express handler), use its configured path
  if (req.route && req.route.path) {
    const basePath = req.baseUrl || "";
    const routePath = req.route.path === "/" && basePath !== "" ? "" : req.route.path;
    return `${method} ${basePath}${routePath}`;
  }
  // Fallback to baseUrl
  return `${method} ${req.baseUrl || req.path}`;
}

/**
 * RBAC Authorization Middleware:
 * Validates caller's realm and role against the route-permission matrix constant.
 * Default policy: STRICT DENY.
 */
export function authorize(explicitRouteKey?: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const routeKey = explicitRouteKey || resolveRouteKey(req);
    const permission: RoutePermission | undefined = ROUTE_PERMISSION_MATRIX[routeKey];

    if (!permission) {
      // Default deny policy
      return next(
        new AppError(
          ErrorCode.FORBIDDEN,
          `Access Denied: Route '${routeKey}' has no registered permission entry in the RBAC matrix`,
          403
        )
      );
    }

    if (permission.isPublic) {
      return next();
    }

    if (!req.actor) {
      return next(
        new AppError(
          ErrorCode.UNAUTHENTICATED,
          "Authentication required to access this resource",
          401
        )
      );
    }

    const { realm, role } = req.actor;

    // Check Realm separation
    if (permission.allowedRealms && !permission.allowedRealms.includes(realm)) {
      return next(
        new AppError(
          ErrorCode.FORBIDDEN,
          `Realm '${realm}' is not authorized to access endpoint '${routeKey}'`,
          403
        )
      );
    }

    // Check Role within User realm
    if (realm === "user" && permission.allowedRoles) {
      if (!role || !permission.allowedRoles.includes(role)) {
        return next(
          new AppError(
            ErrorCode.FORBIDDEN,
            `Role '${role || "none"}' does not have permission to execute '${routeKey}'`,
            403
          )
        );
      }
    }

    next();
  };
}
