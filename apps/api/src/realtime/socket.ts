import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { logger } from "../config/logger.js";
import { env } from "../config/env.js";

let io: Server | null = null;

export function initSocketServer(server: HttpServer): Server {
  io = new Server(server, {
    cors: {
      origin: env.CORS_ORIGIN,
      credentials: true,
    },
  });

  io.on("connection", (socket: Socket) => {
    const tenantId = socket.handshake.query.tenantId as string | undefined;

    if (tenantId) {
      socket.join(`tenant:${tenantId}`);
      logger.info({ socketId: socket.id, tenantId }, "Client connected to realtime socket");
    }

    socket.on("disconnect", () => {
      logger.debug({ socketId: socket.id }, "Socket client disconnected");
    });
  });

  return io;
}

export function broadcastAlert(tenantId: string, alertData: any): void {
  if (io) {
    io.to(`tenant:${tenantId}`).emit("alert:new", alertData);
    logger.info({ tenantId, alertId: alertData._id || alertData.id }, "Pushed alert to dashboard via Socket.IO");
  }
}

