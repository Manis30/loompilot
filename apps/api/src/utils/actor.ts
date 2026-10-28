import { Request } from "express";
import { UserRole } from "@loompilot/shared";
import { UnauthorizedError } from "../errors/index.js";

export interface Actor {
  userId: string;
  email: string;
  role: UserRole;
  tenantId: string;
}

export function actorFrom(req: Request): Actor {
  if (req.user) {
    return {
      userId: req.user.userId,
      email: req.user.email,
      role: req.user.role,
      tenantId: req.user.tenantId,
    };
  }

  // Fallback for internal agent gateway or system calls
  const tenantId = (req.headers["x-tenant-id"] as string) || req.body?.tenantId;
  if (tenantId) {
    return {
      userId: "system-agent",
      email: "agent@internal.system",
      role: UserRole.OWNER,
      tenantId,
    };
  }

  throw new UnauthorizedError("User context is required");
}
