import { describe, it, expect } from "vitest";
import * as Models from "../../src/models/index.js";

describe("Strict Reference Types Enforcement (ObjectId vs String)", () => {
  const modelEntries = Object.entries(Models).filter(
    ([_, model]) => typeof model === "function" && (model as any).schema
  );

  it("verifies all 22 Schema v4 models are loaded", () => {
    expect(modelEntries.length).toBe(22);
  });

  function checkSchemaPaths(modelName: string, prefix: string, paths: Record<string, any>) {
    for (const [pathName, pathObj] of Object.entries<any>(paths)) {
      const fullPath = prefix ? `${prefix}.${pathName}` : pathName;

      // tenantId must remain String
      if (pathName === "tenantId") {
        expect(pathObj.instance, `In ${modelName}, tenantId must be String`).toBe("String");
        continue;
      }

      // Check single ref path
      if (pathObj.options && pathObj.options.ref) {
        expect(
          pathObj.instance,
          `In ${modelName}, path '${fullPath}' has ref '${pathObj.options.ref}' but its type is '${pathObj.instance}' (must be ObjectId)`
        ).toBe("ObjectId");
      }

      // Check array ref path
      if (
        pathObj.instance === "Array" &&
        pathObj.caster &&
        pathObj.caster.options &&
        pathObj.caster.options.ref
      ) {
        expect(
          pathObj.caster.instance,
          `In ${modelName}, array path '${fullPath}' has item ref '${pathObj.caster.options.ref}' but caster instance is '${pathObj.caster.instance}' (must be ObjectId)`
        ).toBe("ObjectId");
      }

      // Recursive check for subdocument / embedded schemas
      if (pathObj.schema && pathObj.schema.paths) {
        checkSchemaPaths(modelName, fullPath, pathObj.schema.paths);
      }
    }
  }

  for (const [modelName, model] of modelEntries) {
    it(`verifies all ref fields in ${modelName} are ObjectId instances (never String)`, () => {
      const schema = (model as any).schema;
      checkSchemaPaths(modelName, "", schema.paths);
    });
  }
});
