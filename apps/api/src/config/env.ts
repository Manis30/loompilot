import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";
import { z } from "zod";

// Load environment variables from .env (check cwd, then monorepo root)
const cwd = process.cwd();
const possibleEnvPaths = [
  path.resolve(cwd, ".env"),
  path.resolve(cwd, "../../.env"),
  path.resolve(cwd, "../.env"),
];
for (const envPath of possibleEnvPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}
dotenv.config(); // fallback default

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),

  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  MONGODB_DB_NAME: z.string().default("loompilot"),

  REDIS_URL: z.string().min(1, "REDIS_URL is required"),

  JWT_ACCESS_SECRET: z.string().min(8, "JWT_ACCESS_SECRET must be at least 8 chars in dev"),
  JWT_REFRESH_SECRET: z.string().min(8, "JWT_REFRESH_SECRET must be at least 8 chars in dev"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL: z.string().default("7d"),

  AGENTS_BASE_URL: z.string().url().default("http://localhost:8000"),
  AGENT_SERVICE_TOKEN: z.string().min(1, "AGENT_SERVICE_TOKEN is required"),

  CORS_ORIGINS: z.string().default("http://localhost:5173"),

  TENANT_DEFAULT_ID: z.string().default("default"),
  TENANT_TIMEZONE: z.string().default("Asia/Kolkata"),

  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  MAIL_FROM: z.string().default("no-reply@loompilot.local"),

  FILE_STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  FILE_STORAGE_PATH: z.string().default("./uploads"),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000), // 15 minutes
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(1000),
  BODY_LIMIT: z.string().default("10mb"),

  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(16).default(12),
  LOCKOUT_THRESHOLD: z.coerce.number().int().positive().default(5),
  LOCKOUT_DURATION_MINUTES: z.coerce.number().int().positive().default(15),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000), // 15 minutes
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  INVITE_TOKEN_TTL: z.string().default("7d"),
});

export type Env = z.infer<typeof envSchema>;

function computeRedisUrl(raw: Record<string, string | undefined>): string {
  if (raw["REDIS_URL"]) return raw["REDIS_URL"];
  const host = raw["REDIS_HOST"] ?? "localhost";
  const port = raw["REDIS_PORT"] ?? "6379";
  const pass = raw["REDIS_PASSWORD"] ? `:${raw["REDIS_PASSWORD"]}@` : "";
  return `redis://${pass}${host}:${port}`;
}

export function validateEnv(raw: Record<string, string | undefined> = process.env): Env {
  const prepared: Record<string, unknown> = {
    NODE_ENV: raw["NODE_ENV"] ?? "development",
    PORT: raw["PORT"] ?? raw["API_PORT"] ?? 4000,
    LOG_LEVEL: raw["LOG_LEVEL"] ?? "info",

    MONGODB_URI: raw["MONGODB_URI"],
    MONGODB_DB_NAME: raw["MONGODB_DB_NAME"] ?? raw["MONGODB_DATABASE"] ?? "loompilot",

    REDIS_URL: computeRedisUrl(raw),

    JWT_ACCESS_SECRET: raw["JWT_ACCESS_SECRET"] ?? raw["JWT_SECRET"],
    JWT_REFRESH_SECRET: raw["JWT_REFRESH_SECRET"],
    ACCESS_TOKEN_TTL: raw["ACCESS_TOKEN_TTL"] ?? raw["JWT_EXPIRES_IN"] ?? "15m",
    REFRESH_TOKEN_TTL: raw["REFRESH_TOKEN_TTL"] ?? raw["JWT_REFRESH_EXPIRES_IN"] ?? "7d",

    AGENTS_BASE_URL: raw["AGENTS_BASE_URL"] ?? raw["AGENTS_SERVICE_URL"] ?? "http://localhost:8000",
    AGENT_SERVICE_TOKEN: raw["AGENT_SERVICE_TOKEN"] ?? raw["INTERNAL_SERVICE_TOKEN"],

    CORS_ORIGINS: raw["CORS_ORIGINS"] ?? raw["CORS_ORIGIN"] ?? "http://localhost:5173",

    TENANT_DEFAULT_ID: raw["TENANT_DEFAULT_ID"] ?? "default",
    TENANT_TIMEZONE: raw["TENANT_TIMEZONE"] ?? "Asia/Kolkata",

    SMTP_HOST: raw["SMTP_HOST"] ?? "localhost",
    SMTP_PORT: raw["SMTP_PORT"] ?? 1025,
    SMTP_USER: raw["SMTP_USER"] ?? "",
    SMTP_PASS: raw["SMTP_PASS"] ?? "",
    MAIL_FROM: raw["MAIL_FROM"] ?? raw["SMTP_FROM"] ?? "no-reply@loompilot.local",

    FILE_STORAGE_DRIVER: raw["FILE_STORAGE_DRIVER"] ?? "local",
    FILE_STORAGE_PATH: raw["FILE_STORAGE_PATH"] ?? "./uploads",

    RATE_LIMIT_WINDOW_MS: raw["RATE_LIMIT_WINDOW_MS"] ?? 900000,
    RATE_LIMIT_MAX: raw["RATE_LIMIT_MAX"] ?? 1000,
    BODY_LIMIT: raw["BODY_LIMIT"] ?? "10mb",

    BCRYPT_ROUNDS: raw["BCRYPT_ROUNDS"] ?? 12,
    LOCKOUT_THRESHOLD: raw["LOCKOUT_THRESHOLD"] ?? 5,
    LOCKOUT_DURATION_MINUTES: raw["LOCKOUT_DURATION_MINUTES"] ?? 15,
    AUTH_RATE_LIMIT_WINDOW_MS: raw["AUTH_RATE_LIMIT_WINDOW_MS"] ?? 900000,
    AUTH_RATE_LIMIT_MAX: raw["AUTH_RATE_LIMIT_MAX"] ?? 20,
    INVITE_TOKEN_TTL: raw["INVITE_TOKEN_TTL"] ?? "7d",
  };

  const parsed = envSchema.safeParse(prepared);

  if (!parsed.success) {
    const errorDetails = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Environment validation failed:\n${errorDetails}`);
  }

  const env = parsed.data;

  // Security enforcement: Refuse to start in production if weak or default secrets are used
  if (env.NODE_ENV === "production") {
    const weakPatterns = ["change_me", "change-me", "default", "secret", "change_in_prod"];
    const isWeak = (val: string) =>
      val.length < 32 || weakPatterns.some((pattern) => val.toLowerCase().includes(pattern));

    const weakSecrets: string[] = [];
    if (isWeak(env.JWT_ACCESS_SECRET)) {
      weakSecrets.push("JWT_ACCESS_SECRET (must be >= 32 characters and not contain weak words)");
    }
    if (isWeak(env.JWT_REFRESH_SECRET)) {
      weakSecrets.push("JWT_REFRESH_SECRET (must be >= 32 characters and not contain weak words)");
    }
    if (isWeak(env.AGENT_SERVICE_TOKEN)) {
      weakSecrets.push("AGENT_SERVICE_TOKEN (must be >= 32 characters and not contain weak words)");
    }

    if (weakSecrets.length > 0) {
      throw new Error(
        `Production security violation! Refusing to start with weak/default secrets:\n${weakSecrets
          .map((s) => `  - ${s}`)
          .join("\n")}`
      );
    }
  }

  return env;
}

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (!cachedEnv) {
    cachedEnv = validateEnv();
  }
  return cachedEnv;
}
