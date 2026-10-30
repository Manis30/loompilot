import { describe, it, expect } from "vitest";
import pino from "pino";
import { serializeError, SerializedSubError } from "../../src/utils/logger.js";
import {
  getRedactedRedisTarget,
  extractErrorCode,
} from "../../src/config/redis.js";

describe("Logger & Error Serialization", () => {
  it("serializes standard Error instances under 'err' serializer", () => {
    const err = new Error("Standard failure message");
    const serialized = serializeError(err) as Record<string, unknown>;

    expect(serialized).toBeDefined();
    expect(serialized["type"]).toBe("Error");
    expect(serialized["message"]).toBe("Standard failure message");
    expect(serialized["stack"]).toBeDefined();
  });

  it("serializes AggregateError by logging its .errors[] (code, address, port)", () => {
    const subErr1 = new Error("connect ECONNREFUSED 127.0.0.1:6379") as Error & {
      code: string;
      address: string;
      port: number;
    };
    subErr1.code = "ECONNREFUSED";
    subErr1.address = "127.0.0.1";
    subErr1.port = 6379;

    const subErr2 = new Error("connect ECONNREFUSED ::1:6379") as Error & {
      code: string;
      address: string;
      port: number;
    };
    subErr2.code = "ECONNREFUSED";
    subErr2.address = "::1";
    subErr2.port = 6379;

    const aggregateError = new AggregateError(
      [subErr1, subErr2],
      "Backing service connection failure"
    );

    const serialized = serializeError(aggregateError) as Record<string, unknown>;

    expect(serialized).toBeDefined();
    expect(serialized["type"]).toBe("AggregateError");
    expect(serialized["message"]).toBe("Backing service connection failure");

    // Must include inner errors array
    const innerErrors = serialized["errors"] as SerializedSubError[];
    expect(Array.isArray(innerErrors)).toBe(true);
    expect(innerErrors).toHaveLength(2);

    expect(innerErrors[0]).toEqual({
      name: "Error",
      message: "connect ECONNREFUSED 127.0.0.1:6379",
      code: "ECONNREFUSED",
      address: "127.0.0.1",
      port: 6379,
    });

    expect(innerErrors[1]).toEqual({
      name: "Error",
      message: "connect ECONNREFUSED ::1:6379",
      code: "ECONNREFUSED",
      address: "::1",
      port: 6379,
    });
  });

  it("produces valid JSON log line with errors[] when logger logs AggregateError under err key", () => {
    let capturedLog = "";
    const testLogger = pino(
      {
        serializers: {
          err: serializeError,
          error: serializeError,
        },
      },
      {
        write: (str: string) => {
          capturedLog += str;
        },
      }
    );

    const subErr = new Error("Connection refused") as Error & {
      code: string;
      address: string;
      port: number;
    };
    subErr.code = "ECONNREFUSED";
    subErr.address = "localhost";
    subErr.port = 6379;

    const aggErr = new AggregateError([subErr], "Redis connection failed");
    testLogger.error({ err: aggErr }, "Backing service failed to start");

    const parsed = JSON.parse(capturedLog);
    expect(parsed.err).toBeDefined();
    expect(parsed.err.type).toBe("AggregateError");
    expect(parsed.err.message).toBe("Redis connection failed");
    expect(parsed.err.errors).toBeDefined();
    expect(parsed.err.errors[0].code).toBe("ECONNREFUSED");
    expect(parsed.err.errors[0].address).toBe("localhost");
    expect(parsed.err.errors[0].port).toBe(6379);
    expect(parsed.msg).toBe("Backing service failed to start");
  });

  it("redacts password from REDIS_URL and extracts host:port", () => {
    const withPassword = "redis://:superSecretP@ssword123!@cache.internal.domain:6380/0";
    const result1 = getRedactedRedisTarget(withPassword);
    expect(result1.host).toBe("cache.internal.domain");
    expect(result1.port).toBe("6380");
    expect(result1.hostPort).toBe("cache.internal.domain:6380");
    expect(result1.hostPort).not.toContain("superSecretP@ssword123!");

    const standardUrl = "redis://127.0.0.1:6379";
    const result2 = getRedactedRedisTarget(standardUrl);
    expect(result2.hostPort).toBe("127.0.0.1:6379");
  });

  it("extracts error code from simple Error and AggregateError", () => {
    const simple = Object.assign(new Error("Refused"), { code: "ECONNREFUSED" });
    expect(extractErrorCode(simple)).toBe("ECONNREFUSED");

    const sub1 = Object.assign(new Error("Refused"), { code: "ETIMEDOUT" });
    const agg = new AggregateError([sub1], "Multiple failures");
    expect(extractErrorCode(agg)).toBe("ETIMEDOUT");

    expect(extractErrorCode(new Error("Generic"))).toBe("UNKNOWN");
    expect(extractErrorCode(null)).toBe("UNKNOWN");
  });
});

