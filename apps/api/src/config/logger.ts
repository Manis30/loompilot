import pino from "pino";
import { env } from "./env.js";

export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : env.NODE_ENV === "production" ? "info" : "debug",
  transport:
    env.NODE_ENV !== "production" && env.NODE_ENV !== "test"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        }
      : undefined,
  base: {
    app: env.APP_NAME,
    env: env.NODE_ENV,
  },
});

export function getRequestLogger(requestId?: string, tenantId?: string) {
  return logger.child({
    requestId: requestId || "unknown",
    ...(tenantId ? { tenantId } : {}),
  });
}
