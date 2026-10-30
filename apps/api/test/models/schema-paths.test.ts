import { describe, it, expect } from "vitest";
import * as Models from "../../src/models/index.js";
import expectedSchemaPaths from "../fixtures/expected-schema-paths.json";
import { SCHEMA_V3_MANIFEST } from "@loompilot/shared";

describe("Strict Schema v3 Path Enforcement (Drift Prevention against Manifest)", () => {
  const modelEntries = Object.entries(Models).filter(
    ([_, model]) => typeof model === "function" && (model as any).schema
  );

  it("verifies that all 41 Schema v3 models are registered in the manifest, fixture, and code", () => {
    expect(modelEntries.length).toBe(41);
    expect(Object.keys(expectedSchemaPaths).length).toBe(41);
    expect(Object.keys(SCHEMA_V3_MANIFEST).length).toBe(41);
  });

  for (const [modelName, model] of modelEntries) {
    it(`verifies schema paths for ${modelName} against Schema v3 manifest and fixture`, () => {
      // 1. Verify existence in Manifest
      const manifestDef = SCHEMA_V3_MANIFEST[modelName];
      expect(
        manifestDef,
        `Model ${modelName} is missing from SCHEMA_V3_MANIFEST in @loompilot/shared`
      ).toBeDefined();

      // 2. Verify existence in Fixture
      const expected = (expectedSchemaPaths as Record<string, string[]>)[modelName];
      expect(
        expected,
        `Model ${modelName} is missing from expected-schema-paths.json fixture`
      ).toBeDefined();

      // 3. Compare actual registered Mongoose schema paths with expected fixture
      const actual = Object.keys((model as any).schema.paths).sort();
      expect(actual).toEqual(expected.slice().sort());
    });
  }
});
