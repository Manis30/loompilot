import { describe, it, expect } from "vitest";
import { APP_NAME } from "@loompilot/shared";

describe("API Smoke Test", () => {
  it("imports shared constants correctly", () => {
    expect(APP_NAME).toBe("LoomPilot");
  });
});

