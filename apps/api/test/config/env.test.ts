import { describe, it, expect } from "vitest";
import { validateEnv } from "../../src/config/env.js";

describe("Environment Configuration Validator", () => {
  const baseValidEnv = {
    NODE_ENV: "development",
    PORT: "4000",
    MONGODB_URI: "mongodb://localhost:27017/loompilot_test",
    MONGODB_DB_NAME: "loompilot_test",
    REDIS_URL: "redis://localhost:6379",
    JWT_ACCESS_SECRET: "my_dev_jwt_access_secret_12345",
    JWT_REFRESH_SECRET: "my_dev_jwt_refresh_secret_12345",
    AGENT_SERVICE_TOKEN: "my_dev_agent_service_token_12345",
  };

  it("validates and parses valid environment variables", () => {
    const env = validateEnv(baseValidEnv);
    expect(env.NODE_ENV).toBe("development");
    expect(env.PORT).toBe(4000);
    expect(env.MONGODB_DB_NAME).toBe("loompilot_test");
    expect(env.TENANT_TIMEZONE).toBe("Asia/Kolkata");
    expect(env.ACCESS_TOKEN_TTL).toBe("15m");
    expect(env.REFRESH_TOKEN_TTL).toBe("7d");
  });

  it("supports legacy and fallback variable names", () => {
    const env = validateEnv({
      NODE_ENV: "development",
      API_PORT: "5000",
      MONGODB_URI: "mongodb://localhost:27017/loompilot_test",
      MONGODB_DATABASE: "custom_db",
      REDIS_HOST: "127.0.0.1",
      REDIS_PORT: "6380",
      JWT_SECRET: "legacy_jwt_secret_12345",
      JWT_REFRESH_SECRET: "legacy_refresh_secret_12345",
      INTERNAL_SERVICE_TOKEN: "legacy_service_token_12345",
      JWT_EXPIRES_IN: "30m",
      JWT_REFRESH_EXPIRES_IN: "14d",
      CORS_ORIGIN: "http://localhost:3000",
    });

    expect(env.PORT).toBe(5000);
    expect(env.MONGODB_DB_NAME).toBe("custom_db");
    expect(env.REDIS_URL).toBe("redis://127.0.0.1:6380");
    expect(env.JWT_ACCESS_SECRET).toBe("legacy_jwt_secret_12345");
    expect(env.AGENT_SERVICE_TOKEN).toBe("legacy_service_token_12345");
    expect(env.ACCESS_TOKEN_TTL).toBe("30m");
    expect(env.REFRESH_TOKEN_TTL).toBe("14d");
    expect(env.CORS_ORIGINS).toBe("http://localhost:3000");
  });

  it("throws descriptive error when required variables are missing", () => {
    expect(() => {
      validateEnv({
        NODE_ENV: "development",
      });
    }).toThrow(/Environment validation failed/);
  });

  it("refuses to start in production if weak secrets are used (< 32 chars)", () => {
    expect(() => {
      validateEnv({
        ...baseValidEnv,
        NODE_ENV: "production",
        JWT_ACCESS_SECRET: "short_secret", // < 32 chars
        JWT_REFRESH_SECRET: "a_very_long_secure_refresh_secret_that_is_32_chars_long",
        AGENT_SERVICE_TOKEN: "a_very_long_secure_service_token_that_is_32_chars_long",
      });
    }).toThrow(/Production security violation/);
  });

  it("refuses to start in production if secrets contain 'change_me' or 'default'", () => {
    expect(() => {
      validateEnv({
        ...baseValidEnv,
        NODE_ENV: "production",
        JWT_ACCESS_SECRET: "loompilot_dev_jwt_secret_change_me_in_production_min_32_chars",
        JWT_REFRESH_SECRET: "a_very_long_secure_refresh_secret_that_is_32_chars_long",
        AGENT_SERVICE_TOKEN: "a_very_long_secure_service_token_that_is_32_chars_long",
      });
    }).toThrow(/Production security violation/);
  });

  it("starts successfully in production when all secrets are strong (>= 32 chars and no weak words)", () => {
    const prodEnv = validateEnv({
      ...baseValidEnv,
      NODE_ENV: "production",
      JWT_ACCESS_SECRET: "e49df0a4b7c64a3d82a1762c9012384a8bc947192adbf3128946123456789012",
      JWT_REFRESH_SECRET: "82a1762c9012384a8bc947192adbf312e49df0a4b7c64a3d8946123456789012",
      AGENT_SERVICE_TOKEN: "c9012384a8bc947192adbf3128946123456789012e49df0a4b7c64a3d82a1762",
    });

    expect(prodEnv.NODE_ENV).toBe("production");
  });
});

