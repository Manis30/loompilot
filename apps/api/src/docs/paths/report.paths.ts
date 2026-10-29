/**
 * OpenAPI 3.0.3 Paths for Business Reports
 */
export const reportPaths = {
  "/api/v1/reports/margin": {
    get: {
      tags: ["Reports"],
      summary: "Get margin report",
      description: "Financial margin and profitability analytics aggregated across confirmed production orders. Includes gross margin percentage, total revenue, and order breakdown. Permitted roles: `owner`, `accounts`. Denied to manager, store, and sales.",
      operationId: "getMarginReport",
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "Aggregated profit margin report.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/MarginReport" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        401: { description: "Unauthorized.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        403: { description: "Forbidden - role insufficient (Owner and Accounts only).", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
      },
    },
  },

  "/api/v1/reports/on-time": {
    get: {
      tags: ["Reports"],
      summary: "Get on-time delivery report",
      description: "Operational performance metrics evaluating order completion against target delivery dates. Includes total deliveries, on-time percentage, and average delay. Permitted roles: `owner`, `manager`, `sales`.",
      operationId: "getOnTimeReport",
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "Operational on-time delivery report.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/OnTimeReport" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        401: { description: "Unauthorized.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        403: { description: "Forbidden - role insufficient.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
      },
    },
  },

  "/api/v1/reports/collections": {
    get: {
      tags: ["Reports"],
      summary: "Get collections aging report",
      description: "Financial accounts receivable aging analysis. Aggregates total invoiced, collected, outstanding, and overdue amounts across aging buckets (current, 1-30 days, 31-60 days, 61+ days). Permitted roles: `owner`, `accounts`.",
      operationId: "getCollectionsReport",
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "Accounts receivable aging summary.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/CollectionsReport" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        401: { description: "Unauthorized.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        403: { description: "Forbidden - role insufficient.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
      },
    },
  },
};

