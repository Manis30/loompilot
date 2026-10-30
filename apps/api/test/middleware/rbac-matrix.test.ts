import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { createContainer } from "../../src/container.js";
import { ROUTE_PERMISSION_MATRIX } from "@loompilot/shared";
import { createTestUser, createTestClientAccount, generateTestAuthHeader } from "../helpers/auth-helper.js";

/**
 * Recursively extracts all registered HTTP endpoints from Express app router stack.
 */
function extractRoutes(app: any): Array<{ method: string; path: string }> {
  const routes: Array<{ method: string; path: string }> = [];

  function print(path: string[], layer: any) {
    if (layer.route) {
      const routePath = layer.route.path;
      const fullPath = [...path, routePath]
        .join("")
        .replace(/\/+/g, "/")
        .replace(/\/$/, "");
      const finalPath = fullPath === "" ? "/" : fullPath;

      for (const method of Object.keys(layer.route.methods)) {
        if (layer.route.methods[method]) {
          routes.push({
            method: method.toUpperCase(),
            path: finalPath,
          });
        }
      }
    } else if (layer.name === "router" && layer.handle.stack) {
      let routerPath = "";
      if (layer.regexp) {
        // Fast regex extract for express router mounts (e.g. /api/v1, /api/v1/users)
        const match = layer.regexp.source
          .replace("^\\", "")
          .replace("\\/?(?=\\/|$)", "")
          .replace(/\\\//g, "/")
          .replace(/\^/g, "")
          .replace(/\$/g, "")
          .replace(/\?.*$/, "");
        if (match && !match.startsWith("\\")) {
          routerPath = match;
        }
      }
      for (const subLayer of layer.handle.stack) {
        print([...path, routerPath], subLayer);
      }
    }
  }

  for (const layer of app._router.stack) {
    print([], layer);
  }

  // Remove duplicates and sort
  const unique = new Map<string, { method: string; path: string }>();
  for (const r of routes) {
    const key = `${r.method} ${r.path}`;
    if (!unique.has(key)) {
      unique.set(key, r);
    }
  }

  return Array.from(unique.values());
}

describe("Stage 3: RBAC Route Permission Matrix", () => {
  const container = createContainer();
  const app = createApp(container);
  const registeredRoutes = extractRoutes(app);

  it("Ensures all registered routes have an exact matching entry in ROUTE_PERMISSION_MATRIX", () => {
    expect(registeredRoutes.length).toBeGreaterThan(0);

    for (const route of registeredRoutes) {
      const routeKey = `${route.method} ${route.path}`;
      // Swagger doc UI paths are handled by swaggerUi.serve
      if (route.path.startsWith("/docs") && route.path !== "/docs.json") continue;
      if (route.path.startsWith("/api-docs")) continue;

      const matrixEntry = ROUTE_PERMISSION_MATRIX[routeKey];
      expect(
        matrixEntry,
        `Route '${routeKey}' is registered in Express but MISSING from ROUTE_PERMISSION_MATRIX`
      ).toBeDefined();
    }
  });

  it("Enforces STRICT DEFAULT DENY policy when an unmapped route is invoked", async () => {
    // Attempting a non-existent route returns 404/403 default deny
    const res = await request(app).get("/api/v1/unregistered-secret-endpoint");
    expect(res.status).toBe(404);
  });

  it("Blocks unauthenticated requests to protected endpoints with 401 UNAUTHENTICATED", async () => {
    const protectedRoutes = [
      { method: "get", path: "/api/v1/me" },
      { method: "get", path: "/api/v1/users" },
      { method: "get", path: "/api/v1/client-accounts" },
      { method: "get", path: "/api/v1/audit" },
      { method: "post", path: "/api/v1/auth/logout-all" },
      { method: "post", path: "/api/v1/client/auth/logout-all" },
    ];

    for (const route of protectedRoutes) {
      const res = await (request(app) as any)[route.method](route.path);
      expect(res.status, `Expected 401 for unauthenticated ${route.method.toUpperCase()} ${route.path}`).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHENTICATED");
    }
  });

  it("Enforces role boundaries: Supervisor is blocked from Admin-only endpoints with 403 FORBIDDEN", async () => {
    const { user: supervisor } = await createTestUser({ role: "supervisor" });
    const supervisorHeader = generateTestAuthHeader({
      subjectId: String(supervisor._id),
      realm: "user",
      role: "supervisor",
      tenantId: supervisor.tenantId,
    });

    const adminOnlyRoutes = [
      { method: "get", path: "/api/v1/users" },
      { method: "post", path: "/api/v1/users", body: { name: "X", email: "x@x.com", password: "p", role: "supervisor" } },
      { method: "get", path: "/api/v1/client-accounts" },
      { method: "post", path: "/api/v1/client-accounts/invite", body: { clientId: "c", email: "c@c.com", name: "C" } },
      { method: "post", path: "/api/v1/clients/c/portal/invite", body: { email: "c@c.com" } },
      { method: "get", path: "/api/v1/audit" },
    ];

    for (const route of adminOnlyRoutes) {
      const req = (request(app) as any)[route.method](route.path).set("Authorization", supervisorHeader);
      if (route.body) req.send(route.body);

      const res = await req;
      expect(res.status, `Expected 403 for supervisor accessing ${route.method.toUpperCase()} ${route.path}`).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    }
  });

  it("Allows Admin to access all protected management endpoints", async () => {
    const { user: admin } = await createTestUser({ role: "admin" });
    const adminHeader = generateTestAuthHeader({
      subjectId: String(admin._id),
      realm: "user",
      role: "admin",
      tenantId: admin.tenantId,
    });

    const resUsers = await request(app).get("/api/v1/users").set("Authorization", adminHeader);
    expect(resUsers.status).toBe(200);

    const resAccounts = await request(app).get("/api/v1/client-accounts").set("Authorization", adminHeader);
    expect(resAccounts.status).toBe(200);

    const resAudit = await request(app).get("/api/v1/audit").set("Authorization", adminHeader);
    expect(resAudit.status).toBe(200);
  });
});

