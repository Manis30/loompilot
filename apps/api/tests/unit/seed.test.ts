import { describe, it, expect, vi, afterEach } from "vitest";
import { runSeed } from "../../src/seed/seed.js";

describe("Unit: Database Seed Security", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("strictly refuses to execute when NODE_ENV is production", async () => {
    process.env.NODE_ENV = "production";
    await expect(runSeed("tenant_prod")).rejects.toThrow(
      "Refusing to seed database when NODE_ENV is production."
    );
  });
});

