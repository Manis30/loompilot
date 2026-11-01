import express, { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

// Import routers directly
import { authRouter } from "../apps/api/src/routes/auth.routes.js";
import { meRouter } from "../apps/api/src/routes/me.routes.js";
import { userRouter } from "../apps/api/src/routes/user.routes.js";
import { clientPortalRouter } from "../apps/api/src/routes/client-portal.routes.js";
import { clientRouter } from "../apps/api/src/routes/client.routes.js";
import { auditRouter } from "../apps/api/src/routes/audit.routes.js";
import { settingsRouter } from "../apps/api/src/routes/settings.routes.js";
import { supplierRouter } from "../apps/api/src/routes/supplier.routes.js";
import { materialRouter } from "../apps/api/src/routes/material.routes.js";
import { machineRouter } from "../apps/api/src/routes/machine.routes.js";
import { productRouter } from "../apps/api/src/routes/product.routes.js";
import { clientCatalogueRouter } from "../apps/api/src/routes/client-catalogue.routes.js";
import { fileRouter } from "../apps/api/src/routes/file.routes.js";
import { stockRouter } from "../apps/api/src/routes/stock.routes.js";
import { importRouter } from "../apps/api/src/routes/import.routes.js";
import { clientOrderRouter } from "../apps/api/src/routes/client-order.routes.js";
import { orderRouter } from "../apps/api/src/routes/order.routes.js";
import { internalGatewayRouter } from "../apps/api/src/routes/internal-gateway.routes.js";
import { webhookRouter } from "../apps/api/src/routes/webhook.routes.js";
import { supervisorRouter } from "../apps/api/src/routes/supervisor.routes.js";
import { supervisorAdminRouter } from "../apps/api/src/routes/supervisor-admin.routes.js";
import { maintenanceTicketRouter } from "../apps/api/src/routes/maintenance-ticket.routes.js";
import { productionRouter } from "../apps/api/src/routes/production.routes.js";
import { procurementRouter } from "../apps/api/src/routes/procurement.routes.js";
import { createHealthRoutes } from "../apps/api/src/routes/health.routes.js";

// Mock HealthController
const mockHealthController: any = {
  getHealth: () => {},
  getReadiness: () => {},
  getLiveness: () => {},
  getMetrics: () => {},
};
const healthRoutes = createHealthRoutes(mockHealthController);

interface MountConfig {
  prefix: string;
  router: Router;
  name: string;
}

const mounts: MountConfig[] = [
  // Health mounted twice: root and /api/v1
  { prefix: "", router: healthRoutes, name: "healthRoutes (root alias)" },
  { prefix: "/api/v1", router: healthRoutes, name: "healthRoutes (/api/v1)" },
  { prefix: "/api/v1", router: authRouter, name: "authRouter" },
  { prefix: "/api/v1/me", router: meRouter, name: "meRouter" },
  { prefix: "/api/v1/users", router: userRouter, name: "userRouter" },
  { prefix: "/api/v1/clients", router: clientPortalRouter, name: "clientPortalRouter" },
  { prefix: "/api/v1/clients", router: clientRouter, name: "clientRouter" },
  { prefix: "/api/v1/audit", router: auditRouter, name: "auditRouter" },
  { prefix: "/api/v1/settings", router: settingsRouter, name: "settingsRouter" },
  { prefix: "/api/v1/suppliers", router: supplierRouter, name: "supplierRouter" },
  { prefix: "/api/v1/materials", router: materialRouter, name: "materialRouter" },
  { prefix: "/api/v1/machines", router: machineRouter, name: "machineRouter" },
  { prefix: "/api/v1/products", router: productRouter, name: "productRouter" },
  { prefix: "/api/v1/client", router: clientCatalogueRouter, name: "clientCatalogueRouter" },
  { prefix: "/api/v1/files", router: fileRouter, name: "fileRouter" },
  { prefix: "/api/v1/stock", router: stockRouter, name: "stockRouter" },
  { prefix: "/api/v1/imports", router: importRouter, name: "importRouter" },
  { prefix: "/api/v1/client/orders", router: clientOrderRouter, name: "clientOrderRouter" },
  { prefix: "/api/v1/orders", router: orderRouter, name: "orderRouter" },
  { prefix: "/internal/v1", router: internalGatewayRouter, name: "internalGatewayRouter" },
  { prefix: "/webhooks", router: webhookRouter, name: "webhookRouter" },
  { prefix: "/api/v1/supervisor", router: supervisorRouter, name: "supervisorRouter" },
  { prefix: "/api/v1/supervisor-reports", router: supervisorAdminRouter, name: "supervisorAdminRouter" },
  { prefix: "/api/v1/maintenance-tickets", router: maintenanceTicketRouter, name: "maintenanceTicketRouter" },
  { prefix: "/api/v1/production", router: productionRouter, name: "productionRouter" },
  { prefix: "/api/v1/purchase-decisions", router: procurementRouter, name: "procurementRouter" },
];

// App-level direct routes
const appLevelRoutes: ExtractedRoute[] = [
  {
    method: "GET",
    path: "/docs.json",
    fullKey: "GET /docs.json",
    routerName: "app.get(/docs.json)",
    hasAuthorizeMiddleware: true,
  },
];

interface ExtractedRoute {
  method: string;
  path: string;
  fullKey: string;
  routerName: string;
  hasAuthorizeMiddleware: boolean;
  authorizedKey?: string;
  isAliased?: boolean;
}

const runtimeRoutes: ExtractedRoute[] = [];

for (const m of mounts) {
  const stack = (m.router as any).stack || [];
  for (const layer of stack) {
    if (layer.route) {
      const subPath = layer.route.path === "/" ? "" : layer.route.path;
      const fullPath = (m.prefix + subPath).replace(/\/+/g, "/") || "/";
      const methods = Object.keys(layer.route.methods)
        .filter((k) => layer.route.methods[k])
        .map((k) => k.toUpperCase());

      // Inspect middleware in layer.route.stack for authorize()
      let hasAuth = false;
      let authorizedKey: string | undefined;

      for (const handlerLayer of layer.route.stack) {
        // check if handler is authorize middleware
        const fnStr = handlerLayer.handle?.toString() || "";
        const name = handlerLayer.handle?.name || "";
        if (fnStr.includes("ROUTE_PERMISSION_MATRIX") || name === "authorize" || fnStr.includes("allowedRealms")) {
          hasAuth = true;
          // extract the permission key if possible
          const match = fnStr.match(/authorize\(\s*["']([^"']+)["']\s*\)/) || fnStr.match(/["']([A-Z]+\s+[^"']+)["']/);
          if (match) {
            authorizedKey = match[1];
          }
        }
      }

      for (const method of methods) {
        runtimeRoutes.push({
          method,
          path: fullPath,
          fullKey: `${method} ${fullPath}`,
          routerName: m.name,
          hasAuthorizeMiddleware: hasAuth,
          authorizedKey,
          isAliased: m.name.includes("alias"),
        });
      }
    }
  }
}

for (const r of appLevelRoutes) {
  runtimeRoutes.push(r);
}

// Read RBAC Matrix
const rbacPath = path.join(rootDir, "packages/shared/src/rbac.ts");
const rbacContent = fs.readFileSync(rbacPath, "utf8");
const rbacEntries: Map<string, { isPublic: boolean; idempotent: boolean }> = new Map();

const routeRegex = /"((?:GET|POST|PUT|PATCH|DELETE)\s+[^"]+)":\s*{([^}]+)}/g;
let match;
while ((match = routeRegex.exec(rbacContent)) !== null) {
  const routeKey = match[1];
  const block = match[2];
  rbacEntries.set(routeKey, {
    isPublic: block.includes("isPublic: true"),
    idempotent: block.includes("idempotent: true"),
  });
}

// Calculations
const totalRuntimeRegistrations = runtimeRoutes.length;
const uniqueMethodPathCombos = new Set(runtimeRoutes.map((r) => r.fullKey));
const totalUniqueMethodPath = uniqueMethodPathCombos.size;
const totalRbacEntries = rbacEntries.size;

// Duplicate / aliased routes
const keyCountMap = new Map<string, number>();
for (const r of runtimeRoutes) {
  keyCountMap.set(r.fullKey, (keyCountMap.get(r.fullKey) || 0) + 1);
}
const duplicateOrAliasedRoutes = runtimeRoutes.filter((r) => (keyCountMap.get(r.fullKey) || 0) > 1 || r.isAliased);

// RBAC entries without runtime routes
const rbacWithoutRuntime = Array.from(rbacEntries.keys()).filter((k) => !uniqueMethodPathCombos.has(k));

// Runtime routes without corresponding RBAC entries
const runtimeWithoutRbac = Array.from(uniqueMethodPathCombos).filter((k) => !rbacEntries.has(k));

console.log("=========================================");
console.log("LOOMPILOT ROUTE INVENTORY AUDIT RESULTS");
console.log("=========================================");
console.log(`1. Total Runtime HTTP Route Registrations: ${totalRuntimeRegistrations}`);
console.log(`2. Total Unique Method/Path Combinations: ${totalUniqueMethodPath}`);
console.log(`3. Total RBAC Permission Entries: ${totalRbacEntries}`);
console.log(`4. Duplicate or Aliased Route Registrations: ${duplicateOrAliasedRoutes.length}`);
console.log(`5. RBAC Entries Without Corresponding Runtime Route: ${rbacWithoutRuntime.length}`);
if (rbacWithoutRuntime.length > 0) {
  console.log("   Details:", rbacWithoutRuntime);
}
console.log(`6. Runtime Routes Without Corresponding RBAC Entry: ${runtimeWithoutRbac.length}`);
if (runtimeWithoutRbac.length > 0) {
  console.log("   Details:", runtimeWithoutRbac);
}
console.log("=========================================");
