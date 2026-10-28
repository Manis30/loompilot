import dotenv from "dotenv";
import { z } from "zod";
import { APP_NAME } from "./constants.js";

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().default(4000),
  API_HOST: z.string().default("0.0.0.0"),
  APP_NAME: z.string().default(APP_NAME),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),

  // JWT Security
  JWT_SECRET: z.string().min(16).default("loompilot_dev_jwt_secret_change_me_in_production_min_32_chars"),
  JWT_EXPIRES_IN: z.string().default("1h"),
  JWT_REFRESH_SECRET: z.string().min(16).default("loompilot_dev_refresh_jwt_secret_change_me_min_32_chars"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

  // Internal Agent Gateway Security
  INTERNAL_SERVICE_TOKEN: z.string().min(16).default("loompilot_internal_agent_gateway_token_change_in_prod"),

  // Databases
  MONGODB_URI: z.string().default("mongodb://localhost:27017/loompilot?replicaSet=rs0"),
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  // Python Agents Service
  AGENTS_SERVICE_URL: z.string().default("http://localhost:8000"),
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = EnvSchema.parse(process.env);

