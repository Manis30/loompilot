export interface RoutePermission {
  routeKey: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  description: string;
  isPublic?: boolean;
  allowedRealms?: ("user" | "client")[];
  allowedRoles?: ("admin" | "supervisor")[];
  idempotent?: boolean;
}

export const ROUTE_PERMISSION_MATRIX: Record<string, RoutePermission> = {
  // Public Auth
  "POST /api/v1/auth/login": {
    routeKey: "POST /api/v1/auth/login",
    method: "POST",
    path: "/api/v1/auth/login",
    description: "Staff portal user login (admin, supervisor)",
    isPublic: true,
    idempotent: false,
  },
  "POST /api/v1/client/auth/login": {
    routeKey: "POST /api/v1/client/auth/login",
    method: "POST",
    path: "/api/v1/client/auth/login",
    description: "Client portal login",
    isPublic: true,
    idempotent: false,
  },
  "POST /api/v1/auth/refresh": {
    routeKey: "POST /api/v1/auth/refresh",
    method: "POST",
    path: "/api/v1/auth/refresh",
    description: "Staff portal token rotation",
    isPublic: true,
    idempotent: false,
  },
  "POST /api/v1/client/auth/refresh": {
    routeKey: "POST /api/v1/client/auth/refresh",
    method: "POST",
    path: "/api/v1/client/auth/refresh",
    description: "Client portal token rotation",
    isPublic: true,
    idempotent: false,
  },
  "POST /api/v1/auth/logout": {
    routeKey: "POST /api/v1/auth/logout",
    method: "POST",
    path: "/api/v1/auth/logout",
    description: "Staff portal session logout",
    isPublic: true,
    idempotent: false,
  },
  "POST /api/v1/client/auth/logout": {
    routeKey: "POST /api/v1/client/auth/logout",
    method: "POST",
    path: "/api/v1/client/auth/logout",
    description: "Client portal session logout",
    isPublic: true,
    idempotent: false,
  },
  "POST /api/v1/auth/logout-all": {
    routeKey: "POST /api/v1/auth/logout-all",
    method: "POST",
    path: "/api/v1/auth/logout-all",
    description: "Staff user logout from all devices",
    allowedRealms: ["user"],
    allowedRoles: ["admin", "supervisor"],
    idempotent: false,
  },
  "POST /api/v1/client/auth/logout-all": {
    routeKey: "POST /api/v1/client/auth/logout-all",
    method: "POST",
    path: "/api/v1/client/auth/logout-all",
    description: "Client account logout from all devices",
    allowedRealms: ["client"],
    idempotent: false,
  },
  "POST /api/v1/client/auth/accept-invite": {
    routeKey: "POST /api/v1/client/auth/accept-invite",
    method: "POST",
    path: "/api/v1/client/auth/accept-invite",
    description: "Accept client invitation and activate account",
    isPublic: true,
    idempotent: true,
  },

  // Self-Service /me
  "GET /api/v1/me": {
    routeKey: "GET /api/v1/me",
    method: "GET",
    path: "/api/v1/me",
    description: "Get authenticated profile and permissions",
    allowedRealms: ["user", "client"],
    allowedRoles: ["admin", "supervisor"],
    idempotent: false,
  },
  "PATCH /api/v1/me": {
    routeKey: "PATCH /api/v1/me",
    method: "PATCH",
    path: "/api/v1/me",
    description: "Update own profile settings",
    allowedRealms: ["user", "client"],
    allowedRoles: ["admin", "supervisor"],
    idempotent: false,
  },
  "POST /api/v1/auth/change-password": {
    routeKey: "POST /api/v1/auth/change-password",
    method: "POST",
    path: "/api/v1/auth/change-password",
    description: "Change password and revoke other sessions",
    allowedRealms: ["user", "client"],
    allowedRoles: ["admin", "supervisor"],
    idempotent: false,
  },

  // Staff User Management (Admin Only)
  "GET /api/v1/users": {
    routeKey: "GET /api/v1/users",
    method: "GET",
    path: "/api/v1/users",
    description: "List staff users",
    allowedRealms: ["user"],
    allowedRoles: ["admin"],
    idempotent: false,
  },
  "POST /api/v1/users": {
    routeKey: "POST /api/v1/users",
    method: "POST",
    path: "/api/v1/users",
    description: "Create staff user",
    allowedRealms: ["user"],
    allowedRoles: ["admin"],
    idempotent: false,
  },
  "PATCH /api/v1/users/:id": {
    routeKey: "PATCH /api/v1/users/:id",
    method: "PATCH",
    path: "/api/v1/users/:id",
    description: "Update staff user",
    allowedRealms: ["user"],
    allowedRoles: ["admin"],
    idempotent: false,
  },
  "POST /api/v1/users/:id/lock": {
    routeKey: "POST /api/v1/users/:id/lock",
    method: "POST",
    path: "/api/v1/users/:id/lock",
    description: "Lock staff user and revoke sessions",
    allowedRealms: ["user"],
    allowedRoles: ["admin"],
    idempotent: false,
  },
  "POST /api/v1/users/:id/unlock": {
    routeKey: "POST /api/v1/users/:id/unlock",
    method: "POST",
    path: "/api/v1/users/:id/unlock",
    description: "Unlock staff user",
    allowedRealms: ["user"],
    allowedRoles: ["admin"],
    idempotent: false,
  },

  // Client Portal Access Management (Admin Only, /api/v1/clients/:id/portal/...)
  "POST /api/v1/clients/:id/portal/invite": {
    routeKey: "POST /api/v1/clients/:id/portal/invite",
    method: "POST",
    path: "/api/v1/clients/:id/portal/invite",
    description: "Invite client contact with one-time invite token",
    allowedRealms: ["user"],
    allowedRoles: ["admin"],
    idempotent: false,
  },
  "POST /api/v1/clients/:id/portal/re-invite": {
    routeKey: "POST /api/v1/clients/:id/portal/re-invite",
    method: "POST",
    path: "/api/v1/clients/:id/portal/re-invite",
    description: "Re-issue invitation for client portal and revoke active sessions",
    allowedRealms: ["user"],
    allowedRoles: ["admin"],
    idempotent: false,
  },
  "POST /api/v1/clients/:id/portal/reinvite": {
    routeKey: "POST /api/v1/clients/:id/portal/reinvite",
    method: "POST",
    path: "/api/v1/clients/:id/portal/reinvite",
    description: "Re-issue invitation for client portal and revoke active sessions",
    allowedRealms: ["user"],
    allowedRoles: ["admin"],
    idempotent: false,
  },
  "POST /api/v1/clients/:id/portal/lock": {
    routeKey: "POST /api/v1/clients/:id/portal/lock",
    method: "POST",
    path: "/api/v1/clients/:id/portal/lock",
    description: "Lock client portal access and revoke sessions",
    allowedRealms: ["user"],
    allowedRoles: ["admin"],
    idempotent: false,
  },
  "POST /api/v1/clients/:id/portal/unlock": {
    routeKey: "POST /api/v1/clients/:id/portal/unlock",
    method: "POST",
    path: "/api/v1/clients/:id/portal/unlock",
    description: "Unlock client portal access",
    allowedRealms: ["user"],
    allowedRoles: ["admin"],
    idempotent: false,
  },

  // Audit Logs (Admin Only)
  "GET /api/v1/audit": {
    routeKey: "GET /api/v1/audit",
    method: "GET",
    path: "/api/v1/audit",
    description: "Query immutable audit logs",
    allowedRealms: ["user"],
    allowedRoles: ["admin"],
    idempotent: false,
  },

  // System & Health Probes
  "GET /health": {
    routeKey: "GET /health",
    method: "GET",
    path: "/health",
    description: "Service health probe",
    isPublic: true,
    idempotent: false,
  },
  "GET /ready": {
    routeKey: "GET /ready",
    method: "GET",
    path: "/ready",
    description: "Service readiness probe (MongoDB, Redis)",
    isPublic: true,
    idempotent: false,
  },
  "GET /api/v1/health": {
    routeKey: "GET /api/v1/health",
    method: "GET",
    path: "/api/v1/health",
    description: "API v1 service health probe",
    isPublic: true,
    idempotent: false,
  },
  "GET /api/v1/ready": {
    routeKey: "GET /api/v1/ready",
    method: "GET",
    path: "/api/v1/ready",
    description: "API v1 service readiness probe",
    isPublic: true,
    idempotent: false,
  },
  "GET /docs.json": {
    routeKey: "GET /docs.json",
    method: "GET",
    path: "/docs.json",
    description: "OpenAPI JSON specification",
    isPublic: true,
    idempotent: false,
  },
};

export const IDEMPOTENT_FLAGGED_ROUTES = new Set(
  Object.values(ROUTE_PERMISSION_MATRIX)
    .filter((r) => r.idempotent)
    .map((r) => r.routeKey)
);
