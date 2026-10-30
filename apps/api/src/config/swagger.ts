export const swaggerSpec = {
  openapi: "3.0.3",
  info: {
    title: "LoomPilot API",
    version: "1.0.0",
    description: "LoomPilot - AI Advisory Platform for Textile Manufacturing Operations",
  },
  servers: [
    {
      url: "/",
      description: "Root Server",
    },
    {
      url: "/api/v1",
      description: "API v1 Base",
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Standard JWT access token header: Bearer <token>",
      },
      ServiceTokenAuth: {
        type: "apiKey",
        in: "header",
        name: "x-service-token",
        description: "Internal service-to-service authentication for AI agent gateway",
      },
      CookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "refreshToken",
        description: "HttpOnly secure refresh token cookie for session renewal",
      },
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string", example: "VALIDATION_FAILED" },
              message: { type: "string", example: "Validation failed" },
              details: { type: "object", nullable: true },
              requestId: { type: "string", example: "a3b8e7c1-..." },
            },
            required: ["code", "message", "requestId"],
          },
        },
        required: ["error"],
      },
      HealthResponse: {
        type: "object",
        properties: {
          status: { type: "string", example: "ok" },
          timestamp: { type: "string", format: "date-time" },
          uptime: { type: "number", example: 12.34 },
        },
        required: ["status", "timestamp", "uptime"],
      },
      ReadinessResponse: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["ready", "not_ready"], example: "ready" },
          mongo: { type: "string", enum: ["connected", "disconnected"], example: "connected" },
          redis: { type: "string", enum: ["connected", "disconnected"], example: "connected" },
          timestamp: { type: "string", format: "date-time" },
        },
        required: ["status", "mongo", "redis", "timestamp"],
      },
    },
    "/api/v1/auth/login": {
      post: {
        summary: "Staff user login",
        tags: ["Authentication"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                  tenantId: { type: "string" },
                },
                required: ["email", "password"],
              },
            },
          },
        },
        responses: {
          "200": { description: "Authentication successful, returns access token and sets httpOnly refresh cookie" },
          "401": { description: "Invalid credentials" },
          "403": { description: "Account is locked" },
        },
      },
    },
    "/api/v1/client/auth/login": {
      post: {
        summary: "Client portal login",
        tags: ["Authentication"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                  tenantId: { type: "string" },
                },
                required: ["email", "password"],
              },
            },
          },
        },
        responses: {
          "200": { description: "Client authentication successful" },
          "401": { description: "Invalid credentials" },
          "403": { description: "Account locked or not accepted" },
        },
      },
    },
    "/api/v1/auth/refresh": {
      post: {
        summary: "Rotate staff access and refresh tokens",
        tags: ["Authentication"],
        responses: {
          "200": { description: "Tokens successfully rotated" },
          "401": { description: "Revoked or invalid token" },
          "409": { description: "Refresh race condition detected" },
        },
      },
    },
    "/api/v1/client/auth/accept-invite": {
      post: {
        summary: "Accept client account invitation",
        tags: ["Authentication"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  token: { type: "string" },
                  password: { type: "string", minLength: 10 },
                },
                required: ["token", "password"],
              },
            },
          },
        },
        responses: {
          "200": { description: "Account activated" },
          "400": { description: "Invalid or expired token" },
        },
      },
    },
    "/api/v1/me": {
      get: {
        summary: "Get current user profile",
        tags: ["Self Service"],
        security: [{ BearerAuth: [] }],
        responses: {
          "200": { description: "Current user profile" },
          "401": { description: "Unauthenticated" },
        },
      },
    },
    "/api/v1/users": {
      get: {
        summary: "List staff users",
        tags: ["User Management"],
        security: [{ BearerAuth: [] }],
        responses: {
          "200": { description: "List of staff users" },
          "403": { description: "Admin permission required" },
        },
      },
    },
    "/api/v1/client-accounts": {
      get: {
        summary: "List client portal accounts",
        tags: ["Client Management"],
        security: [{ BearerAuth: [] }],
        responses: {
          "200": { description: "List of client accounts" },
          "403": { description: "Admin permission required" },
        },
      },
    },
    "/api/v1/audit": {
      get: {
        summary: "Query audit logs",
        tags: ["Audit"],
        security: [{ BearerAuth: [] }],
        responses: {
          "200": { description: "Paginated audit logs" },
          "403": { description: "Admin permission required" },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        summary: "Liveness probe",
        description: "Returns 200 if the Node.js API process is alive and responsive.",
        responses: {
          "200": {
            description: "Process is healthy",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HealthResponse" },
              },
            },
          },
        },
      },
    },
    "/ready": {
      get: {
        summary: "Readiness probe",
        description: "Verifies connectivity to MongoDB Atlas and Redis cluster.",
        responses: {
          "200": {
            description: "All backing services are connected and ready",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ReadinessResponse" },
              },
            },
          },
          "503": {
            description: "One or more backing services are disconnected",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ReadinessResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/auth/login": {
      post: {
        summary: "Staff user login",
        tags: ["Authentication"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                  tenantId: { type: "string" },
                },
                required: ["email", "password"],
              },
            },
          },
        },
        responses: {
          "200": { description: "Authentication successful, returns access token and sets httpOnly refresh cookie" },
          "401": { description: "Invalid credentials" },
          "403": { description: "Account is locked" },
        },
      },
    },
    "/api/v1/client/auth/login": {
      post: {
        summary: "Client portal login",
        tags: ["Authentication"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                  tenantId: { type: "string" },
                },
                required: ["email", "password"],
              },
            },
          },
        },
        responses: {
          "200": { description: "Client authentication successful" },
          "401": { description: "Invalid credentials" },
          "403": { description: "Account locked or not accepted" },
        },
      },
    },
    "/api/v1/auth/refresh": {
      post: {
        summary: "Rotate staff access and refresh tokens",
        tags: ["Authentication"],
        responses: {
          "200": { description: "Tokens successfully rotated" },
          "401": { description: "Revoked or invalid token" },
          "409": { description: "Refresh race condition detected" },
        },
      },
    },
    "/api/v1/client/auth/accept-invite": {
      post: {
        summary: "Accept client account invitation",
        tags: ["Authentication"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  token: { type: "string" },
                  password: { type: "string", minLength: 10 },
                },
                required: ["token", "password"],
              },
            },
          },
        },
        responses: {
          "200": { description: "Account activated" },
          "400": { description: "Invalid or expired token" },
        },
      },
    },
    "/api/v1/me": {
      get: {
        summary: "Get current user profile",
        tags: ["Self Service"],
        security: [{ BearerAuth: [] }],
        responses: {
          "200": { description: "Current user profile" },
          "401": { description: "Unauthenticated" },
        },
      },
    },
    "/api/v1/users": {
      get: {
        summary: "List staff users",
        tags: ["User Management"],
        security: [{ BearerAuth: [] }],
        responses: {
          "200": { description: "List of staff users" },
          "403": { description: "Admin permission required" },
        },
      },
    },
    "/api/v1/client-accounts": {
      get: {
        summary: "List client portal accounts",
        tags: ["Client Management"],
        security: [{ BearerAuth: [] }],
        responses: {
          "200": { description: "List of client accounts" },
          "403": { description: "Admin permission required" },
        },
      },
    },
    "/api/v1/audit": {
      get: {
        summary: "Query audit logs",
        tags: ["Audit"],
        security: [{ BearerAuth: [] }],
        responses: {
          "200": { description: "Paginated audit logs" },
          "403": { description: "Admin permission required" },
        },
      },
    },
  },
};

