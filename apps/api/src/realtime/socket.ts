import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { logger } from "../config/logger.js";
import { env } from "../config/env.js";
import { UserRole } from "@loompilot/shared";

let io: Server | null = null;

export interface AuthenticatedSocketUser {
  userId: string;
  email: string;
  role: UserRole;
  tenantId: string;
}

export function stripFinancialsFromPayload<T = any>(payload: T): T {
  if (!payload || typeof payload !== "object") return payload;
  if (Array.isArray(payload)) {
    return payload.map(stripFinancialsFromPayload) as unknown as T;
  }

  const forbiddenKeys = new Set([
    "cost",
    "unitCost",
    "totalCost",
    "unitCostPaise",
    "totalCostPaise",
    "materialCostPaise",
    "processingCostPaise",
    "overheadCostPaise",
    "wastageCostPaise",
    "riskBufferCostPaise",
    "subtotalCostPaise",
    "marginPct",
    "profitPaise",
    "currentRatePaise",
    "avgCostPaise",
  ]);

  const stripped: any = {};
  for (const [key, val] of Object.entries(payload)) {
    if (!forbiddenKeys.has(key)) {
      stripped[key] = typeof val === "object" ? stripFinancialsFromPayload(val) : val;
    }
  }
  return stripped;
}

export function initSocketServer(server: HttpServer): Server {
  io = new Server(server, {
    cors: {
      origin: env.CORS_ORIGIN,
      credentials: true,
    },
  });

  // Strict JWT handshake authentication middleware
  io.use((socket: Socket, next) => {
    try {
      const authHeader = socket.handshake.headers.authorization;
      const token =
        socket.handshake.auth?.token ||
        (authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null);

      if (!token) {
        return next(new Error("Unauthorized: Missing realtime auth token"));
      }

      const decoded = jwt.verify(token, env.JWT_SECRET) as AuthenticatedSocketUser;
      if (!decoded.tenantId || !decoded.role || !decoded.userId) {
        return next(new Error("Unauthorized: Invalid token payload"));
      }

      socket.data.user = decoded;
      next();
    } catch {
      return next(new Error("Unauthorized: Token verification failed"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const user: AuthenticatedSocketUser = socket.data.user;

    // Join tenant room, role-specific room, and user room
    socket.join(`tenant:${user.tenantId}`);
    socket.join(`tenant:${user.tenantId}:role:${user.role}`);
    socket.join(`user:${user.userId}`);

    logger.info(
      { socketId: socket.id, tenantId: user.tenantId, role: user.role, userId: user.userId },
      "Client authenticated and joined realtime rooms"
    );

    socket.on("disconnect", () => {
      logger.debug({ socketId: socket.id, userId: user.userId }, "Realtime client disconnected");
    });
  });

  return io;
}

export function getSocketServer(): Server | null {
  return io;
}

/**
 * Broadcast an alert to allowed roles only (Owner and Manager per docs/roles-matrix.md).
 * Store role is strictly excluded, and any event payload dispatched to store
 * has cost and margin fields stripped.
 */
export function broadcastAlert(
  tenantId: string,
  alertData: any,
  allowedRoles: UserRole[] = [UserRole.OWNER, UserRole.MANAGER]
): void {
  if (!io) return;

  for (const role of allowedRoles) {
    const payload = role === UserRole.STORE ? stripFinancialsFromPayload(alertData) : alertData;
    io.to(`tenant:${tenantId}:role:${role}`).emit("alert:new", payload);
  }

  logger.info(
    { tenantId, alertId: alertData._id || alertData.id, roles: allowedRoles },
    "Pushed production alert via role-targeted Socket.IO rooms"
  );
}

/**
 * Broadcast a tenant-wide realtime message, automatically stripping financial details
 * for the store role room.
 */
export function broadcastToTenant(tenantId: string, event: string, payload: any): void {
  if (!io) return;

  // Send unmasked payload to privileged roles
  const privilegedRoles = [
    UserRole.OWNER,
    UserRole.MANAGER,
    UserRole.SALES,
    UserRole.ACCOUNTS,
  ];
  for (const role of privilegedRoles) {
    io.to(`tenant:${tenantId}:role:${role}`).emit(event, payload);
  }

  // Send masked payload to store role (never send cost or margin data to store)
  const maskedPayload = stripFinancialsFromPayload(payload);
  io.to(`tenant:${tenantId}:role:${UserRole.STORE}`).emit(event, maskedPayload);
}
