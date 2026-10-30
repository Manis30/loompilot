import { describe, it, expect } from "vitest";
import * as Models from "../../src/models/index.js";

describe("Strict Reference Types Enforcement (ObjectId vs String)", () => {
  const modelEntries = Object.entries(Models).filter(
    ([_, model]) => typeof model === "function" && (model as any).schema
  );

  it("verifies all 41 models are loaded", () => {
    expect(modelEntries.length).toBe(41);
  });

  for (const [modelName, model] of modelEntries) {
    it(`verifies all ref fields in ${modelName} are ObjectId instances (never String)`, () => {
      const schema = (model as any).schema;
      const paths = schema.paths;

      for (const [pathName, pathObj] of Object.entries<any>(paths)) {
        // tenantId must remain String
        if (pathName === "tenantId") {
          expect(
            pathObj.instance,
            `In ${modelName}, tenantId must be String`
          ).toBe("String");
          continue;
        }

        // Check single ref path
        if (pathObj.options && pathObj.options.ref) {
          expect(
            pathObj.instance,
            `In ${modelName}, path '${pathName}' has ref '${pathObj.options.ref}' but its type is '${pathObj.instance}' (must be ObjectId)`
          ).toBe("ObjectId");
        }

        // Check array ref path (e.g. affectedOrderIds: [{ type: Schema.Types.ObjectId, ref: 'Order' }])
        if (
          pathObj.instance === "Array" &&
          pathObj.caster &&
          pathObj.caster.options &&
          pathObj.caster.options.ref
        ) {
          expect(
            pathObj.caster.instance,
            `In ${modelName}, array path '${pathName}' has item ref '${pathObj.caster.options.ref}' but caster instance is '${pathObj.caster.instance}' (must be ObjectId)`
          ).toBe("ObjectId");
        }

        // Check subdocument schema paths if this path is a DocumentArray or Embedded
        if (pathObj.schema && pathObj.schema.paths) {
          for (const [subPathName, subPathObj] of Object.entries<any>(pathObj.schema.paths)) {
            if (subPathObj.options && subPathObj.options.ref) {
              expect(
                subPathObj.instance,
                `In ${modelName}, embedded path '${pathName}.${subPathName}' has ref '${subPathObj.options.ref}' but its type is '${subPathObj.instance}' (must be ObjectId)`
              ).toBe("ObjectId");
            }
            if (
              subPathObj.instance === "Array" &&
              subPathObj.caster &&
              subPathObj.caster.options &&
              subPathObj.caster.options.ref
            ) {
              expect(
                subPathObj.caster.instance,
                `In ${modelName}, embedded array path '${pathName}.${subPathName}' has item ref '${subPathObj.caster.options.ref}' but caster instance is '${subPathObj.caster.instance}' (must be ObjectId)`
              ).toBe("ObjectId");
            }
          }
        }
      }
    });
  }
});

