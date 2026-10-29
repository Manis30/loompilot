/**
 * OpenAPI 3.0.3 Paths for Health Checks
 */
export const healthPaths = {
  "/health": {
    get: {
      tags: ["Health"],
      summary: "System health check",
      description: "Returns application operational status, application name constant, and ISO 8601 server timestamp. Unauthenticated endpoint for load balancers and orchestrators.",
      operationId: "getHealth",
      responses: {
        200: {
          description: "System is healthy.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/HealthResponse" },
            },
          },
        },
      },
    },
  },

  "/health/live": {
    get: {
      tags: ["Health"],
      summary: "Liveness probe",
      description: "Returns 200 OK as long as the Express process is running and responding to HTTP traffic.",
      operationId: "getHealthLive",
      responses: {
        200: {
          description: "Service is live.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/HealthResponse" },
            },
          },
        },
      },
    },
  },

  "/health/ready": {
    get: {
      tags: ["Health"],
      summary: "Readiness probe",
      description: "Checks active database connectivity (MongoDB replica set) and Redis cache ping. Returns 200 when ready, 503 when dependencies are unreachable.",
      operationId: "getHealthReady",
      responses: {
        200: {
          description: "All dependencies are connected and ready to process traffic.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: { type: "string", example: "ok" },
                  app: { type: "string", example: "LoomPilot" },
                  mongo: { type: "string", example: "connected" },
                  redis: { type: "string", example: "connected" },
                  timestamp: { type: "string", format: "date-time" },
                },
              },
            },
          },
        },
        503: {
          description: "One or more dependencies are disconnected.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: { type: "string", example: "unhealthy" },
                  app: { type: "string", example: "LoomPilot" },
                  mongo: { type: "string", example: "disconnected" },
                  redis: { type: "string", example: "disconnected" },
                  timestamp: { type: "string", format: "date-time" },
                },
              },
            },
          },
        },
      },
    },
  },
};
