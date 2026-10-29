/**
 * OpenAPI 3.0.3 Paths for Alerts and AI Recovery Recommendations
 */
export const alertPaths = {
  "/api/alerts": {
    get: {
      tags: ["Alerts"],
      summary: "List production shortfall alerts",
      description: "Returns paginated list of shortfall alerts triggered by daily output deficits or supplier delays. Accessible to all authenticated roles.",
      operationId: "listAlerts",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "page", in: "query", schema: { type: "integer", default: 1 } },
        { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
        { name: "isAcknowledged", in: "query", schema: { type: "boolean" }, description: "Filter by acknowledgment status" },
        { name: "orderId", in: "query", schema: { type: "string" }, description: "Filter by Production Order ID" },
      ],
      responses: {
        200: {
          description: "Paginated list of alerts.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { type: "array", items: { $ref: "#/components/schemas/Alert" } },
                  total: { type: "integer", example: 4 },
                  page: { type: "integer", example: 1 },
                  limit: { type: "integer", example: 20 },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        401: { description: "Unauthorized.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
      },
    },
  },

  "/api/alerts/{id}/ack": {
    post: {
      tags: ["Alerts"],
      summary: "Acknowledge alert",
      description: "Marks a production alert as acknowledged. Permitted roles: `owner`, `manager`.",
      operationId: "acknowledgeAlert",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Alert ObjectId" },
      ],
      responses: {
        200: {
          description: "Alert acknowledged successfully.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/Alert" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        401: { description: "Unauthorized.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        403: { description: "Forbidden - role insufficient.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        404: { description: "Alert not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
      },
    },
  },

  "/api/alerts/recommendations": {
    get: {
      tags: ["Alerts"],
      summary: "List recovery recommendations",
      description: "Retrieves AI-generated recovery options (extra workers, revised daily targets, catchup schedules). Accessible to all authenticated roles.",
      operationId: "listRecommendations",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "page", in: "query", schema: { type: "integer", default: 1 } },
        { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
        { name: "status", in: "query", schema: { type: "string", enum: ["proposed", "accepted", "rejected"] } },
        { name: "alertId", in: "query", schema: { type: "string" } },
      ],
      responses: {
        200: {
          description: "Paginated recovery recommendations.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { type: "array", items: { $ref: "#/components/schemas/Recommendation" } },
                  total: { type: "integer", example: 2 },
                  page: { type: "integer", example: 1 },
                  limit: { type: "integer", example: 20 },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        401: { description: "Unauthorized.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
      },
    },
  },

  "/api/alerts/recommendations/{id}/decide": {
    post: {
      tags: ["Alerts"],
      summary: "Decide recovery recommendation",
      description: "Accepts or rejects an AI recovery recommendation. In LoomPilot, AI recommends but human decides. Permitted roles: `owner`, `manager`.",
      operationId: "decideRecommendation",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Recommendation ObjectId" },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/DecideRecommendationRequest" },
          },
        },
      },
      responses: {
        200: {
          description: "Decision recorded successfully.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/Recommendation" },
                  requestId: { $ref: "#/components/schemas/RequestId" },
                },
              },
            },
          },
        },
        400: { description: "Validation error.", content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } } },
        401: { description: "Unauthorized.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        403: { description: "Forbidden - role insufficient.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
        404: { description: "Recommendation not found.", content: { "application/json": { schema: { $ref: "#/components/schemas/StandardError" } } } },
      },
    },
  },
};

