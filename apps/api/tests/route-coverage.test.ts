import { describe, it, expect } from "vitest";
import { app } from "../src/app.js";
import { openapiSpec } from "../src/docs/openapi.js";

interface RouteDefinition {
  method: string;
  path: string;
}

function extractExpressRoutes(expressApp: any): RouteDefinition[] {
  const routes: RouteDefinition[] = [];

  function cleanPath(p: string): string {
    return p
      .replace(/\/+/g, "/")
      .replace(/\/$/, "")
      .replace(/:([a-zA-Z0-9_]+)/g, "{$1}") || "/";
  }

  function parseLayer(pathPrefix: string, layer: any) {
    if (layer.route) {
      const fullPath = cleanPath(`${pathPrefix}${layer.route.path}`);
      for (const m of Object.keys(layer.route.methods)) {
        if (layer.route.methods[m]) {
          routes.push({ method: m.toLowerCase(), path: fullPath });
        }
      }
    } else if (layer.name === "router" && layer.handle?.stack) {
      let mountPath = "";
      if (layer.regexp) {
        const str = layer.regexp.toString();
        // Match expressions like /^\/api\/v1\/auth\/?(?=\/|$)/i
        const match = str.match(/\^\\(\/(?:[^\\]|\\.)*?)\\\/\?\(\?=/);
        if (match && match[1]) {
          mountPath = match[1].replace(/\\/g, "");
        }
      }
      for (const subLayer of layer.handle.stack) {
        parseLayer(`${pathPrefix}${mountPath}`, subLayer);
      }
    }
  }

  for (const layer of expressApp._router.stack) {
    parseLayer("", layer);
  }

  return routes;
}

describe("OpenAPI Route Coverage Verification", () => {
  it("ensures every registered Express route is documented in the OpenAPI spec and vice versa", () => {
    const registeredRoutes = extractExpressRoutes(app).filter(
      (r) => !r.path.startsWith("/api-docs")
    );

    // Build map of openapi routes
    const openapiRoutes: RouteDefinition[] = [];
    for (const [pathKey, pathItem] of Object.entries(openapiSpec.paths as Record<string, any>)) {
      for (const method of ["get", "post", "put", "patch", "delete"]) {
        if (pathItem[method]) {
          openapiRoutes.push({ method, path: pathKey });
        }
      }
    }

    const formatRoute = (r: RouteDefinition) => `${r.method.toUpperCase()} ${r.path}`;

    const registeredSet = new Set(registeredRoutes.map(formatRoute));
    const openapiSet = new Set(openapiRoutes.map(formatRoute));

    const missingInOpenApi = registeredRoutes
      .map(formatRoute)
      .filter((r) => !openapiSet.has(r));

    const missingInExpress = openapiRoutes
      .map(formatRoute)
      .filter((r) => !registeredSet.has(r));

    expect(
      missingInOpenApi,
      `The following Express routes are registered but missing in OpenAPI spec:\n${missingInOpenApi.join("\n")}`
    ).toEqual([]);

    expect(
      missingInExpress,
      `The following OpenAPI routes are documented but not registered in Express:\n${missingInExpress.join("\n")}`
    ).toEqual([]);
  });
});

