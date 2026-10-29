/**
 * OpenAPI 3.0.3 Paths for Health Check
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
};

