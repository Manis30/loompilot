import pino from "pino";

const redactPaths = [
  "req.headers.authorization",
  'req.headers["x-service-token"]',
  'req.headers["x-razorpay-signature"]',
  "req.headers.cookie",
  "req.headers['set-cookie']",
  "password",
  "passwordHash",
  "token",
  "refreshToken",
  "secret",
  "apiKey",
  "serviceToken",
  "razorpayKeySecret",
  "razorpay_signature",
  "razorpayWebhookSecret",
  "*.password",
  "*.passwordHash",
  "*.token",
  "*.refreshToken",
  "*.secret",
  "*.apiKey",
  "*.serviceToken",
  "*.razorpayKeySecret",
  "*.razorpay_signature",
  "*.razorpayWebhookSecret",
];

export interface SerializedSubError {
  name?: string;
  message?: string;
  code?: string;
  address?: string;
  port?: number;
}

/**
 * Custom error serializer that wraps pino.stdSerializers.err and ensures
 * AggregateError instances serialize their inner .errors[] with code, address, and port.
 */
export function serializeError(err: unknown): Record<string, unknown> | unknown {
  if (!err || typeof err !== "object") {
    return err;
  }

  const serialized = pino.stdSerializers.err(err as Error) as Record<string, unknown>;

  // Serialize AggregateError by extracting .errors[] (code, address, port)
  const agg = err as { errors?: unknown[] };
  if (Array.isArray(agg.errors)) {
    serialized["errors"] = agg.errors.map((subErr) => {
      if (subErr && typeof subErr === "object") {
        const s = subErr as {
          name?: string;
          message?: string;
          code?: string;
          address?: string;
          port?: number;
        };
        return {
          name: s.name,
          message: s.message,
          code: s.code,
          address: s.address,
          port: s.port,
        };
      }
      return subErr;
    });
  }

  return serialized;
}

export const logger = pino({
  level: process.env["LOG_LEVEL"] || "info",
  redact: {
    paths: redactPaths,
    censor: "[REDACTED]",
  },
  base: {
    env: process.env["NODE_ENV"] || "development",
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  serializers: {
    err: serializeError,
    error: serializeError,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
